begin;

create or replace function public.lothuus_hosting_report() returns jsonb
language sql stable security invoker set search_path='' as $$
 with a as (
  select *, case when plan<>'basis' and valid_until>now() then plan else 'basis' end as active_plan
  from app_private.hosting_account where id
 ), e as (
  select coalesce(sum(extra),0) as extra from app_private.hosting_entitlements
 )
 select jsonb_build_object(
  'plan',a.active_plan,
  'extra',e.extra,
  'count',a.object_count,
  'limit',(case a.active_plan when 'premium' then 1000 when 'pro' then 500 else 200 end)+e.extra,
  'validUntil',a.valid_until,
  'updatedAt',now(),
  'metrics',coalesce((
   select jsonb_object_agg(metric,jsonb_build_object(
    'value',value,'measuredAt',measured_at,'status',status,
    'periodStart',period_start,'periodEnd',period_end
   )) from app_private.hosting_metrics
  ),'{}') || jsonb_build_object(
   'cached',jsonb_build_object('value',null,'measuredAt',null,'status','not_applicable')
  ),
  'orders',coalesce((
   select jsonb_agg(row_to_json(o) order by o."createdAt" desc)
   from (
    select id,product,cents,status,created_at as "createdAt",activated_at as "activatedAt"
    from app_private.hosting_orders order by created_at desc limit 30
   ) o
  ),'[]')
 ) from a cross join e;
$$;

create or replace function app_private.hosting_check_capacity() returns trigger
language plpgsql security invoker set search_path='' as $$
declare a app_private.hosting_account; capacity integer; bonus integer;
begin
 if jsonb_array_length(new.body->'items')<=jsonb_array_length(old.body->'items') then return new; end if;
 select * into a from app_private.hosting_account where id for update;
 if not found then raise exception 'HOSTING_ACCOUNT_UNAVAILABLE'; end if;
 select coalesce(sum(extra),0) into bonus from app_private.hosting_entitlements;
 capacity:=case
  when a.plan='premium' and a.valid_until>now() then 1000
  when a.plan='pro' and a.valid_until>now() then 500
  else 200
 end + bonus;
 if jsonb_array_length(new.body->'items')>capacity then raise exception 'HOSTING_OBJECT_LIMIT'; end if;
 return new;
end; $$;

revoke all on function app_private.hosting_check_capacity() from public,anon,authenticated;
grant execute on function app_private.hosting_check_capacity() to service_role;

commit;
