begin;

-- Catalogue/report inputs only. Private customers, mail, order capabilities and
-- upload metadata never leave Postgres for a public catalogue request.
create or replace function public.lothuus_catalogue_projection() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('schemaVersion',1,'settings',body->'settings','settingsVersion',body->'settingsVersion',
 'customers','[]'::jsonb,'emails','[]'::jsonb,'notifications','[]'::jsonb,'requests','{}'::jsonb,'limits','{}'::jsonb,
 'items',coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
   'id',i->'id','sourceReference',i->'sourceReference','publication',i->'publication',
   'productNumber',i->'productNumber','title',i->'title','category',i->'category',
   'photos',i->'photos','sourcePhotos',(select jsonb_agg(jsonb_build_object('id',p->'id')) from jsonb_array_elements(coalesce(i->'sourcePhotos','[]'))p),
   'version',i->'version') || case when i->>'publication'='published' then
   jsonb_build_object('description',i->'description','date',i->'date','material',i->'material',
   'dimensions',i->'dimensions','maker',i->'maker','condition',i->'condition','priceCents',i->'priceCents') else '{}'::jsonb end))
   from jsonb_array_elements(body->'items')i),'[]'),
 'reservations',coalesce((select jsonb_agg(jsonb_build_object(
   'id',r->'id','itemId',r->'itemId','createdAt',r->'createdAt','source',r->'source','priceCents',r->'priceCents',
   'payments',(select coalesce(jsonb_agg(jsonb_build_object('type',p->'type','amountCents',p->'amountCents')),'[]') from jsonb_array_elements(coalesce(r->'payments','[]'))p),
   'lines',r->'lines','status',case when r->>'status'='active' and jsonb_typeof(r->'lines')='array'
      and (r->>'deadline')::timestamptz<=now() and coalesce((select sum(case when p->>'type'='receipt' then (p->>'amountCents')::bigint else -(p->>'amountCents')::bigint end)from jsonb_array_elements(coalesce(r->'payments','[]'))p),0)=0
      then 'expired' else r->>'status' end)) from jsonb_array_elements(body->'reservations')r),'[]'))
 from app_private.store where id;
$$;

create index if not exists heart_days_latest on app_private.heart_days(object_id,day desc) where added>0;
create index if not exists heart_states_selected on app_private.heart_states(object_id,browser_hash) where selected;
create or replace function public.lothuus_heart_report_window(from_day date,to_day date) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('enabled',h.enabled,'startedAt',h.started_at,
 'plan',(select case when a.plan<>'basis' and a.valid_until>now() then a.plan else 'basis' end from app_private.hosting_account a where id),
 'objects',coalesce((select jsonb_agg(snapshot) from app_private.heart_objects),'[]'),
 'days',coalesce((select jsonb_agg(jsonb_build_object('day',day,'id',object_id,'added',added,'removed',removed,'ordered',ordered))
   from app_private.heart_days where day>=greatest(from_day,(now() at time zone 'Europe/Brussels')::date-interval '24 months',
     case when exists(select 1 from app_private.hosting_account a where a.plan<>'basis' and a.valid_until>now()) then from_day else (now() at time zone 'Europe/Brussels')::date-6 end)
     and day<=least(to_day,(now() at time zone 'Europe/Brussels')::date)),'[]'),
 'latest',coalesce((select jsonb_agg(t) from (select object_id as id,max(day) as day from app_private.heart_days where added>0 group by object_id)t),'[]'),
 'recent',coalesce((select jsonb_agg(t) from (select s.object_id as id,count(*) as count,max(b.seen_at) as "lastSeen"
   from app_private.heart_states s join app_private.heart_browsers b on b.hash=s.browser_hash
   where s.selected and b.seen_at>=now()-interval '90 days' group by s.object_id)t),'[]'))
 from app_private.heart_settings h where id;
$$;

alter table app_private.analytics_config add column if not exists daily_limit integer not null default 5000 check(daily_limit between 100 and 50000);
create table if not exists app_private.analytics_daily_limits(day date primary key,hits integer not null);
alter table app_private.analytics_daily_limits enable row level security;
grant select,insert,update,delete on app_private.analytics_daily_limits to service_role;
create or replace function public.lothuus_analytics_visit_budgeted(event_id uuid,device_kind text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare stamp timestamptz:=statement_timestamp(); ceiling integer; hits integer; inserted uuid;
begin
 if device_kind not in ('desktop','mobile','tablet','unknown') then raise exception 'Invalid device'; end if;
 select daily_limit into ceiling from app_private.analytics_config where id and enabled;
 if ceiling is null then return jsonb_build_object('accepted',false,'limited',false); end if;
 if exists(select 1 from app_private.analytics_events where id=event_id) then return jsonb_build_object('accepted',true,'limited',false); end if;
 insert into app_private.analytics_limits as l values(date_trunc('minute',stamp),1)
   on conflict(minute) do update set hits=l.hits+1 where l.hits<120 returning l.hits into hits;
 if hits is null then return jsonb_build_object('accepted',false,'limited',true,'resetAt',date_trunc('minute',stamp)+interval '1 minute'); end if;
 hits:=null;
 insert into app_private.analytics_daily_limits as l values((stamp at time zone 'UTC')::date,1)
   on conflict(day) do update set hits=l.hits+1 where l.hits<ceiling returning l.hits into hits;
 if hits is null then return jsonb_build_object('accepted',false,'limited',true,'resetAt',date_trunc('day',stamp at time zone 'UTC') at time zone 'UTC'+interval '1 day'); end if;
 insert into app_private.analytics_events values(event_id,stamp,device_kind) on conflict(id) do nothing returning id into inserted;
 if inserted is not null then
  insert into app_private.analytics_days as d values((stamp at time zone 'Europe/Brussels')::date,device_kind,1)
   on conflict(day,device) do update set visits=d.visits+1;
 end if;
 return jsonb_build_object('accepted',true,'limited',false);
end; $$;
-- The previous deployment receives the same durable budget during rollout.
create or replace function public.lothuus_analytics_visit(event_id uuid,device_kind text) returns void
language plpgsql security invoker set search_path='' as $$
begin perform public.lothuus_analytics_visit_budgeted(event_id,device_kind); end; $$;
create or replace function public.lothuus_analytics_cleanup() returns void
language plpgsql security invoker set search_path='' as $$
begin
 delete from app_private.analytics_events where id in(select id from app_private.analytics_events where accepted_at<statement_timestamp()-interval '48 hours' order by accepted_at limit 20000);
 delete from app_private.analytics_limits where minute<statement_timestamp()-interval '2 minutes';
 delete from app_private.analytics_daily_limits where day<(now() at time zone 'UTC')::date-2;
end; $$;

create table if not exists app_private.maintenance_jobs (
 name text primary key,lease_id uuid,lease_until timestamptz,last_success timestamptz,
 status text not null default 'unavailable',details jsonb not null default '{}'
);
alter table app_private.maintenance_jobs enable row level security;
grant select,insert,update,delete on app_private.maintenance_jobs to service_role;
create or replace function public.lothuus_maintenance_claim(job_name text,job_id uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare claimed text;
begin
 if job_name not in ('backup','supabase-usage') then raise exception 'Invalid job'; end if;
 insert into app_private.maintenance_jobs as j(name,lease_id,lease_until,status)
 values(job_name,job_id,now()+interval '5 minutes','running') on conflict(name) do update
 set lease_id=job_id,lease_until=now()+interval '5 minutes',status='running'
 where coalesce(j.lease_until,'epoch')<now() and coalesce(j.last_success,'epoch')<date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'
 returning name into claimed;
 return claimed is not null;
end; $$;
create or replace function public.lothuus_maintenance_finish(job_name text,job_id uuid,succeeded boolean,metadata jsonb) returns void
language sql security invoker set search_path='' as $$
 update app_private.maintenance_jobs set lease_until=null,lease_id=null,status=case when succeeded then 'ready' else 'error' end,
 last_success=case when succeeded then now() else last_success end,details=case when succeeded then metadata else details||metadata end where name=job_name and lease_id=job_id;
$$;
create or replace function public.lothuus_operations_report() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'backup',coalesce((select jsonb_build_object('status',status,'lastSuccess',last_success) from app_private.maintenance_jobs where name='backup'),jsonb_build_object('status','unavailable','lastSuccess',null)),
 'supabase',coalesce((select details||jsonb_build_object('status',status,'measuredAt',last_success) from app_private.maintenance_jobs where name='supabase-usage'),jsonb_build_object('status','unavailable','value',null,'measuredAt',null)));
$$;

-- Durable business records and aggregate statistics. Deliberately exclude
-- transient visitor IDs, browser-linked heart state, rate limits and job leases.
create or replace function public.lothuus_backup_state() returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare tables jsonb:='{}'; rows jsonb; t text;
begin
 foreach t in array array['store','media','product_numbers','stock_claims','heart_settings','heart_objects','heart_days',
 'analytics_config','analytics_days','hosting_account','hosting_orders','hosting_entitlements','hosting_media_objects','hosting_metrics','hosting_usage_daily'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(t)),''[]''::jsonb) from app_private.%I t',t) into rows;
  tables:=tables||jsonb_build_object(t,rows);
 end loop;
 return jsonb_build_object('schemaVersion',2,'createdAt',now(),'tables',tables);
end; $$;

revoke all on function public.lothuus_catalogue_projection(),public.lothuus_heart_report_window(date,date),public.lothuus_analytics_visit_budgeted(uuid,text),public.lothuus_maintenance_claim(text,uuid),public.lothuus_maintenance_finish(text,uuid,boolean,jsonb),public.lothuus_operations_report() from public,anon,authenticated;
grant execute on function public.lothuus_catalogue_projection(),public.lothuus_heart_report_window(date,date),public.lothuus_analytics_visit_budgeted(uuid,text),public.lothuus_maintenance_claim(text,uuid),public.lothuus_maintenance_finish(text,uuid,boolean,jsonb),public.lothuus_operations_report() to service_role;

-- Keep run history bounded, including runs from previously unscheduled jobs.
select cron.schedule('lothuus-cron-log-retention','23 3 * * *',
 $$delete from cron.job_run_details where end_time<now()-interval '7 days'$$);
commit;
