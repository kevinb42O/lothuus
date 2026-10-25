begin;
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to service_role;
create table if not exists app_private.analytics_config (
  id boolean primary key default true check(id), enabled boolean not null default true,
  started_at timestamptz not null default statement_timestamp()
);
insert into app_private.analytics_config(id) values (true) on conflict(id) do nothing;
create table if not exists app_private.analytics_events (
  id uuid primary key, accepted_at timestamptz not null, device text not null check(device in ('desktop','mobile','tablet','unknown'))
);
create index if not exists analytics_events_time on app_private.analytics_events(accepted_at);
create table if not exists app_private.analytics_days (
  day date not null, device text not null check(device in ('desktop','mobile','tablet','unknown')),
  visits bigint not null check(visits >= 0), primary key(day,device)
);
create table if not exists app_private.analytics_limits (minute timestamptz primary key, hits integer not null);
alter table app_private.analytics_config enable row level security;
alter table app_private.analytics_events enable row level security;
alter table app_private.analytics_days enable row level security;
alter table app_private.analytics_limits enable row level security;
grant select,insert,update,delete on app_private.analytics_config,app_private.analytics_events,app_private.analytics_days,app_private.analytics_limits to service_role;

create or replace function public.lothuus_analytics_visit(event_id uuid, device_kind text) returns void
language plpgsql security invoker set search_path = '' as $$
declare stamp timestamptz := statement_timestamp(); hit_count integer; inserted uuid;
begin
  if device_kind not in ('desktop','mobile','tablet','unknown') then raise exception 'Invalid device'; end if;
  if not (select enabled from app_private.analytics_config where id) then return; end if;
  -- A shared ceiling controls database growth without collecting an IP or browser key.
  insert into app_private.analytics_limits as limits values(date_trunc('minute',stamp),1)
    on conflict(minute) do update set hits=limits.hits+1 returning limits.hits into hit_count;
  if hit_count > 2000 then return; end if;
  insert into app_private.analytics_events values(event_id,stamp,device_kind)
    on conflict(id) do nothing returning id into inserted;
  if inserted is not null then
    insert into app_private.analytics_days as days values((stamp at time zone 'Europe/Brussels')::date,device_kind,1)
      on conflict(day,device) do update set visits=days.visits+1;
  end if;
end; $$;

create or replace function public.lothuus_analytics_report(from_day date, report_to timestamptz, rolling boolean) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'enabled',config.enabled,'startedAt',config.started_at,'now',statement_timestamp(),
    'days',coalesce((select jsonb_agg(jsonb_build_object('day',d.day,'device',d.device,'visits',d.visits) order by d.day)
      from app_private.analytics_days d where d.day >= from_day),'[]'::jsonb),
    -- Aggregate inside PostgreSQL: the server never downloads individual event keys.
    'events',coalesce((select jsonb_agg(jsonb_build_object('at',e.at,'device',e.device,'visits',e.visits) order by e.at)
      from (select min(accepted_at) as at,device,count(*) as visits from app_private.analytics_events
        where accepted_at >= greatest(case when rolling then report_to-interval '24 hours' else report_to end,statement_timestamp()-interval '48 hours')
          and (not rolling or accepted_at < report_to)
        group by device,case when rolling then date_bin(interval '1 hour',accepted_at,report_to-interval '24 hours')
          else date_trunc('day',accepted_at at time zone 'Europe/Brussels') at time zone 'Europe/Brussels' end
      ) e),'[]'::jsonb)
  ) from app_private.analytics_config config where id;
$$;

create or replace function public.lothuus_analytics_cleanup() returns void
language plpgsql security invoker set search_path = '' as $$
begin
  delete from app_private.analytics_events where id in (
    select id from app_private.analytics_events where accepted_at < statement_timestamp()-interval '48 hours' order by accepted_at limit 20000
  );
  delete from app_private.analytics_limits where minute < statement_timestamp()-interval '2 minutes';
end; $$;
revoke all on function public.lothuus_analytics_visit(uuid,text),public.lothuus_analytics_report(date,timestamptz,boolean),public.lothuus_analytics_cleanup() from public,anon,authenticated;
grant execute on function public.lothuus_analytics_visit(uuid,text),public.lothuus_analytics_report(date,timestamptz,boolean),public.lothuus_analytics_cleanup() to service_role;

-- Avoid rerunning Supabase's extension grant hooks when Cron is already installed.
do $$ begin
  if not exists(select 1 from pg_extension where extname='pg_cron') then
    create extension pg_cron with schema pg_catalog;
  end if;
end; $$;
select cron.schedule('lothuus-analytics-cleanup','*/5 * * * *','select public.lothuus_analytics_cleanup()');
commit;
