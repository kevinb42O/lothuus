-- An authenticated workspace opening is distinct from a successful password login.
begin;
create or replace function public.lothuus_admin_usage(actor uuid,events jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare e jsonb; a text; s text; p text; added bigint;
begin
 if jsonb_typeof(events)<>'array' or jsonb_array_length(events) not between 1 and 20 or actor is null then raise exception 'INVALID_USAGE'; end if;
 for e in select value from jsonb_array_elements(events) loop
  a:=e->>'action';s:=e->>'section';p:=coalesce(e->>'product','');
  if a is null or a not in ('workspace_open','nav_overview','nav_items','nav_reservations','nav_customers','nav_emails','nav_settings','nav_hearts','nav_hosting','nav_visitors','nav_updates','product_add','product_open','capacity_plans','usage_view','plans_view','usage_refresh','usage_details','plan_pro','plan_business','billing_month','billing_year','payment_capacity','payment_open','payment_close','payment_order','payment_paid','payment_iban','payment_details','payment_cancel','faq_maintenance','faq_backup','faq_free','faq_availability') or s is null or s not in ('overview','items','reservations','customers','emails','settings','hearts','hosting','visitors','updates') or p not in ('','pro_month','pro_year','premium_month','premium_year','extra50','extra150') then raise exception 'INVALID_USAGE'; end if;
  added:=null;
  insert into app_private.operator_usage_events(event_id,actor_id,action,section,product) values((e->>'id')::uuid,actor,a,s,p) on conflict(event_id) do nothing returning sequence into added;
  if added is not null then
   if a='workspace_open' then
    insert into app_private.operator_activity(actor_id,kind,title,dedupe_key)
    values(actor,'workspace_open','Werkruimte opnieuw geopend','workspace:'||(e->>'id'));
   end if;
   insert into app_private.operator_usage_daily(day,actor_id,action,section,product,hits) values((now() at time zone 'Europe/Brussels')::date,actor,a,s,p,1)
   on conflict(day,actor_id,action,section,product) do update set hits=operator_usage_daily.hits+1;
  end if;
 end loop;
end; $$;

create or replace function public.lothuus_operator_usage(actor uuid,period_days integer default 30,before_id bigint default null,category_filter text default 'all') returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;first_day date;
begin
 if not public.lothuus_operator_enabled(actor) then raise exception 'OPERATOR_FORBIDDEN';end if;
 if period_days not in (7,30,90) or category_filter not in ('all','packages','usage','workspace') then raise exception 'INVALID_OPERATOR_INPUT';end if;
 first_day:=(now() at time zone 'Europe/Brussels')::date-period_days+1;
 with daily as materialized(select * from app_private.operator_usage_daily where day>=first_day),
 recent as(select sequence,sequence::text as id,at,action,section,product from app_private.operator_usage_events where at>=first_day::timestamp at time zone 'Europe/Brussels' and (before_id is null or sequence<before_id) and (category_filter='all' or category_filter='packages' and (action like 'plan_%' or action like 'billing_%' or action like 'payment_%' or action in ('plans_view','capacity_plans')) or category_filter='usage' and (action like 'usage_%' or action='nav_hosting') or category_filter='workspace' and action not like 'plan_%' and action not like 'billing_%' and action not like 'payment_%' and action not like 'usage_%' and action not in ('plans_view','capacity_plans','nav_hosting')) order by sequence desc limit 50)
 select jsonb_build_object(
 'days',period_days,'recordingSince',(select min(at) from app_private.operator_usage_events),
 'lastInteraction',(select max(at) from app_private.operator_usage_events),
 'totals',(select jsonb_build_object('actions',coalesce(sum(hits) filter(where action not in ('usage_view','plans_view','workspace_open')),0),'hostingOpens',coalesce(sum(hits) filter(where action='nav_hosting'),0),'usageViews',coalesce(sum(hits) filter(where action='usage_view'),0),'usageRefreshes',coalesce(sum(hits) filter(where action='usage_refresh'),0),'plansViews',coalesce(sum(hits) filter(where action='plans_view'),0),'planClicks',coalesce(sum(hits) filter(where action in ('plan_pro','plan_business')),0),'paymentOpens',coalesce(sum(hits) filter(where action='payment_open'),0),'orderClicks',coalesce(sum(hits) filter(where action='payment_order'),0),'paymentClaims',coalesce(sum(hits) filter(where action='payment_paid'),0)) from daily),
 'top',coalesce((select jsonb_agg(to_jsonb(t) order by t.hits desc,t.action) from(select action,sum(hits)::integer as hits from daily where action not in ('usage_view','plans_view','workspace_open') group by action order by hits desc,action limit 20)t),'[]'),
 'products',coalesce((select jsonb_agg(to_jsonb(t) order by t.product) from(select product,sum(hits) filter(where action in ('plan_pro','plan_business')) as clicks,sum(hits) filter(where action='payment_open') as opens,sum(hits) filter(where action='payment_order') as orders,sum(hits) filter(where action='payment_paid') as claims from daily where product<>'' group by product)t),'[]'),
 'daily',coalesce((select jsonb_agg(to_jsonb(t) order by day) from(select day,sum(hits) filter(where action not in ('usage_view','plans_view','workspace_open')) as clicks,sum(hits) filter(where action in ('plan_pro','plan_business','plans_view')) as packages,sum(hits) filter(where action in ('usage_view','usage_refresh','usage_details')) as usage from daily group by day)t),'[]'),
 'events',coalesce((select jsonb_agg(to_jsonb(r)-'sequence' order by sequence desc) from recent r),'[]')) into result;
 return result;
end; $$;

create or replace function public.lothuus_operator_activity_page(actor uuid,search_text text default '',event_filter text default 'all',actor_filter text default 'all',since_at timestamptz default null,until_at timestamptz default null,before_id bigint default null,page_size integer default 50) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if not public.lothuus_operator_enabled(actor) then raise exception 'OPERATOR_FORBIDDEN'; end if;
 if length(search_text)>120 or page_size not between 1 and 1000 or actor_filter not in ('all','owner','operator','system') or event_filter not in ('all','product','access','capacity','payment','operator') then raise exception 'INVALID_OPERATOR_INPUT'; end if;
 with matches as materialized (
 select a.*,case when a.actor_id is null then 'Systeem' when exists(select 1 from app_private.operator_users u where u.user_id=a.actor_id) then 'Kevin' else 'Eigenaar' end as actor
 from app_private.operator_activity a
 where (since_at is null or at>=since_at) and (until_at is null or at<until_at)
 and position(lower(trim(search_text)) in lower(title||' '||coalesce(details->>'number','')||' '||kind||' '||coalesce(details->>'reason','')))>0
 and (event_filter='all' or event_filter='product' and kind like 'product_%' or event_filter='access' and kind in ('owner_login','superadmin_login','sessions_revoked','workspace_open') or event_filter='capacity' and kind in ('capacity_denied','policy_changed') or event_filter='payment' and kind='payment_activated' or event_filter='operator' and kind in ('note_changed','maintenance_requested','export_created','sessions_revoked'))
 and (actor_filter='all' or actor_filter='system' and actor_id is null or actor_filter='operator' and exists(select 1 from app_private.operator_users u where u.user_id=a.actor_id) or actor_filter='owner' and actor_id is not null and not exists(select 1 from app_private.operator_users u where u.user_id=a.actor_id))
 ), page as (select id as sequence,id::text as id,at,actor_id,kind,object_id,title,details,matches.actor from matches where before_id is null or id<before_id order by id desc limit page_size)
 select jsonb_build_object('activity',coalesce((select jsonb_agg(to_jsonb(p)-'sequence' order by sequence desc) from page p),'[]'),'total',(select count(*) from matches)) into result;
 return result;
end; $$;
-- Replacing existing functions retains their service-role-only grants.
commit;
