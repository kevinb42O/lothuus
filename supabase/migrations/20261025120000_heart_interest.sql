begin;
create table if not exists app_private.heart_settings (
 id boolean primary key default true check(id), enabled boolean not null default true,
 started_at timestamptz not null default now()
);
insert into app_private.heart_settings(id) values(true) on conflict do nothing;
create table if not exists app_private.heart_objects (
 id text primary key, snapshot jsonb not null
);
create table if not exists app_private.heart_browsers (
 hash text primary key, seen_at timestamptz not null default now()
);
create table if not exists app_private.heart_states (
 browser_hash text not null references app_private.heart_browsers(hash) on delete cascade,
 object_id text not null references app_private.heart_objects(id),
 selected boolean not null, sequence bigint not null,
 primary key(browser_hash, object_id)
);
create table if not exists app_private.heart_days (
 day date not null, object_id text not null references app_private.heart_objects(id),
 added integer not null default 0, removed integer not null default 0, ordered integer not null default 0,
 primary key(day, object_id)
);
alter table app_private.heart_settings enable row level security;
alter table app_private.heart_objects enable row level security;
alter table app_private.heart_browsers enable row level security;
alter table app_private.heart_states enable row level security;
alter table app_private.heart_days enable row level security;
revoke all on app_private.heart_settings, app_private.heart_objects, app_private.heart_browsers, app_private.heart_states, app_private.heart_days from public, anon, authenticated;
grant select,insert,update,delete on app_private.heart_settings, app_private.heart_objects, app_private.heart_browsers, app_private.heart_states, app_private.heart_days to service_role;
create index if not exists heart_browsers_seen on app_private.heart_browsers(seen_at);
-- Also called on reads/writes: retention works without relying on an open dashboard.
create or replace function public.lothuus_heart_cleanup() returns void
language sql security invoker set search_path = '' as $$
 delete from app_private.heart_browsers where seen_at < now() - interval '90 days';
 delete from app_private.heart_days where day < (now() at time zone 'Europe/Brussels')::date - interval '24 months';
$$;
create or replace function public.lothuus_heart_config(next_enabled boolean default null) returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin
 if next_enabled is not null then update app_private.heart_settings set enabled=next_enabled where id; end if;
 return (select jsonb_build_object('enabled', enabled, 'startedAt', started_at) from app_private.heart_settings where id);
end; $$;
create or replace function public.lothuus_heart_write(browser_key text, actions jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare a jsonb; previous app_private.heart_states%rowtype; did_exist boolean; is_selected boolean; seq bigint; object_key text; is_baseline boolean;
begin
 if length(browser_key) <> 64 or jsonb_typeof(actions) <> 'array' or jsonb_array_length(actions) > 100 then raise exception 'Invalid heart batch'; end if;
 if not (select enabled from app_private.heart_settings where id) then return; end if;
 perform public.lothuus_heart_cleanup();
 insert into app_private.heart_browsers(hash) values(browser_key) on conflict(hash) do update set seen_at=now();
 -- Serialize every batch for the same browser, including concurrent tabs and retries.
 perform 1 from app_private.heart_browsers where hash=browser_key for update;
 for a in select value from jsonb_array_elements(actions) loop
  object_key := a->>'id'; seq := (a->>'sequence')::bigint;
  is_selected := (a->>'selected')::boolean; is_baseline := coalesce((a->>'baseline')::boolean,false);
  if length(object_key) > 128 or seq < 0 then raise exception 'Invalid heart action'; end if;
  insert into app_private.heart_objects(id,snapshot) values(object_key,a->'object') on conflict(id) do update set snapshot=excluded.snapshot;
  select * into previous from app_private.heart_states where browser_hash=browser_key and object_id=object_key;
  did_exist := found;
  if did_exist and previous.sequence >= seq then continue; end if;
  if not is_baseline and is_selected is distinct from (case when did_exist then previous.selected else false end) then
   insert into app_private.heart_days(day,object_id,added,removed)
    values((now() at time zone 'Europe/Brussels')::date,object_key,case when is_selected then 1 else 0 end,case when is_selected then 0 else 1 end)
    on conflict(day,object_id) do update set added=heart_days.added+excluded.added,removed=heart_days.removed+excluded.removed;
  end if;
  insert into app_private.heart_states(browser_hash,object_id,selected,sequence) values(browser_key,object_key,is_selected,seq)
   on conflict(browser_hash,object_id) do update set selected=excluded.selected,sequence=excluded.sequence;
 end loop;
end; $$;
create or replace function public.lothuus_heart_forget(browser_key text) returns void
language sql security invoker set search_path = '' as $$
 delete from app_private.heart_browsers where hash=browser_key;
$$;
-- The capability is validated on the server, then again here against the committed order.
-- No browser key or identity is stored with an order.
create or replace function public.lothuus_heart_order(browser_key text, capability_hash text, client_sequence bigint) returns void
language plpgsql security invoker set search_path = '' as $$
declare reservation jsonb; line jsonb; object_key text;
begin
 if not (select enabled from app_private.heart_settings where id) then return; end if;
 select value into reservation from app_private.store cross join lateral jsonb_array_elements(body->'reservations') where value->>'tokenHash'=capability_hash and value->>'source'='web';
 if reservation is null then return; end if;
 perform 1 from app_private.heart_browsers where hash=browser_key for update;
 for line in select value from jsonb_array_elements(coalesce(reservation->'lines',jsonb_build_array(jsonb_build_object('itemId',reservation->>'itemId')))) loop
  object_key := line->>'itemId';
  update app_private.heart_states set selected=false,sequence=client_sequence where browser_hash=browser_key and object_id=object_key and selected and sequence < client_sequence;
  if found then
   insert into app_private.heart_days(day,object_id,ordered) values((now() at time zone 'Europe/Brussels')::date,object_key,1)
   on conflict(day,object_id) do update set ordered=heart_days.ordered+1;
  end if;
 end loop;
end; $$;
create or replace function public.lothuus_heart_report() returns jsonb
language plpgsql security invoker set search_path = '' as $$
begin
 perform public.lothuus_heart_cleanup();
 return (select jsonb_build_object('enabled',enabled,'startedAt',started_at,
 'objects',(select coalesce(jsonb_agg(snapshot),'[]') from app_private.heart_objects),
 'days',(select coalesce(jsonb_agg(jsonb_build_object('day',day,'id',object_id,'added',added,'removed',removed,'ordered',ordered)),'[]') from app_private.heart_days),
 'recent',(select coalesce(jsonb_agg(r),'[]') from (select s.object_id as id,count(*) as count,max(b.seen_at) as "lastSeen" from app_private.heart_states s join app_private.heart_browsers b on b.hash=s.browser_hash where s.selected group by s.object_id) r)) from app_private.heart_settings where id);
end; $$;
revoke all on function public.lothuus_heart_cleanup(), public.lothuus_heart_config(boolean), public.lothuus_heart_write(text,jsonb), public.lothuus_heart_forget(text), public.lothuus_heart_order(text,text,bigint), public.lothuus_heart_report() from public,anon,authenticated;
grant execute on function public.lothuus_heart_cleanup(), public.lothuus_heart_config(boolean), public.lothuus_heart_write(text,jsonb), public.lothuus_heart_forget(text), public.lothuus_heart_order(text,text,bigint), public.lothuus_heart_report() to service_role;
-- pg_cron is optional; request-time cleanup remains available on every installation.
do $block$
begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  perform cron.schedule('lothuus-heart-retention','17 3 * * *','select public.lothuus_heart_cleanup()');
 end if;
end $block$;
commit;
