begin;
create table if not exists app_private.hosting_account (
 id boolean primary key default true check(id), plan text not null default 'basis' check(plan in ('basis','pro','premium')),
 valid_until timestamptz, object_count integer not null default 0 check(object_count>=0), updated_at timestamptz not null default now()
);
create table if not exists app_private.hosting_orders (
 id uuid primary key, product text not null check(product in ('extra50','extra150','pro_month','pro_year','premium_month','premium_year')),
 cents integer not null check(cents>0), status text not null default 'pending_payment' check(status in ('pending_payment','payment_review','active','cancelled')),
 created_at timestamptz not null default now(), activated_at timestamptz, confirmed_by text, bank_reference text, payload text not null,
 extra integer not null default 0, months integer not null default 0, target_plan text
);
create table if not exists app_private.hosting_entitlements (
 order_id uuid primary key references app_private.hosting_orders(id), extra integer not null check(extra in (50,150)), created_at timestamptz not null default now()
);
create table if not exists app_private.hosting_media_objects (
 key text primary key check(key ~ '^(originals|variants)/'), bytes bigint not null check(bytes>=0), scan_id uuid, updated_at timestamptz not null default now()
);
create table if not exists app_private.hosting_metrics (
 metric text primary key check(metric in ('media','database','direct')), value bigint check(value>=0), measured_at timestamptz,
 status text not null default 'unavailable' check(status in ('ready','unavailable','error')), period_start timestamptz, period_end timestamptz
);
create table if not exists app_private.hosting_jobs (
 id boolean primary key default true check(id), lease_id uuid, lease_until timestamptz, last_completed timestamptz,
 scan_id uuid, scan_started timestamptz, scan_cursor text
);
create table if not exists app_private.hosting_usage_daily (
 day date primary key, bytes bigint not null check(bytes>=0), measured_at timestamptz not null default now()
);
insert into app_private.hosting_account(id,object_count) select true,jsonb_array_length(body->'items') from app_private.store where id on conflict(id) do nothing;
insert into app_private.hosting_jobs(id) values(true) on conflict do nothing;
insert into app_private.hosting_metrics(metric) values('media'),('database'),('direct') on conflict do nothing;
create or replace function app_private.hosting_store_count() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if jsonb_array_length(new.body->'items') is distinct from jsonb_array_length(old.body->'items') then
 update app_private.hosting_account set object_count=jsonb_array_length(new.body->'items'),updated_at=now() where id;
 end if; return new;
end; $$;
drop trigger if exists hosting_store_count on app_private.store;
create trigger hosting_store_count after update of body on app_private.store for each row execute function app_private.hosting_store_count();

create or replace function public.lothuus_hosting_report() returns jsonb language sql stable security invoker set search_path='' as $$
 with a as (select *,case when plan<>'basis' and valid_until>now() then plan else 'basis' end as active_plan from app_private.hosting_account where id),
 e as (select coalesce(sum(extra),0) as extra from app_private.hosting_entitlements)
 select jsonb_build_object('plan',a.active_plan,'extra',e.extra,'count',a.object_count,
 'limit',(case a.active_plan when 'premium' then 500 when 'pro' then 300 else 150 end)+e.extra,
 'validUntil',a.valid_until,'updatedAt',now(),
 'metrics',coalesce((select jsonb_object_agg(metric,jsonb_build_object('value',value,'measuredAt',measured_at,'status',status,'periodStart',period_start,'periodEnd',period_end)) from app_private.hosting_metrics),'{}') || jsonb_build_object('cached',jsonb_build_object('value',null,'measuredAt',null,'status','not_applicable')),
 'orders',coalesce((select jsonb_agg(row_to_json(o) order by o."createdAt" desc) from (select id,product,cents,status,created_at as "createdAt",activated_at as "activatedAt" from app_private.hosting_orders order by created_at desc limit 30)o),'[]')) from a cross join e;
$$;
create or replace function public.lothuus_hosting_order(order_id uuid, product_code text, epc_payload text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare price integer; bonus integer:=0; duration integer:=0; target text; existing app_private.hosting_orders; expected text; bank_label text;
begin
 case product_code
 when 'extra50' then price:=2500;bonus:=50;bank_label:='Uitbreiding 50 Kunstwerken';
 when 'extra150' then price:=5000;bonus:=150;bank_label:='Uitbreiding 150 Kunstwerken';
 when 'pro_month' then price:=2500;duration:=1;target:='pro';bank_label:='Pro Plan Maandelijks';
 when 'pro_year' then price:=24000;duration:=12;target:='pro';bank_label:='Pro Plan Jaarlijks';
 when 'premium_month' then price:=4900;duration:=1;target:='premium';bank_label:='Premium Plan Maandelijks';
 when 'premium_year' then price:=49000;duration:=12;target:='premium';bank_label:='Premium Plan Jaarlijks';
 else raise exception 'Invalid product'; end case;
 expected:=E'BCD\n002\n1\nSCT\n\nKevin Bourguignon\nBE43738004886701\nEUR'||(price/100)::text||E'.00\n\n'||bank_label;
 if epc_payload<>expected then raise exception 'Invalid payment payload'; end if;
 -- Serialize duplicate submissions and bound pending orders without locking the main store.
 perform 1 from app_private.hosting_account where id for update;
 select * into existing from app_private.hosting_orders where id=order_id;
 if found then if existing.product<>product_code then raise exception 'Order key conflict';end if;return public.lothuus_hosting_report();end if;
 if (select count(*) from app_private.hosting_orders where status in ('pending_payment','payment_review'))>=10 then raise exception 'Too many pending orders';end if;
 insert into app_private.hosting_orders(id,product,cents,payload,extra,months,target_plan) values(order_id,product_code,price,expected,bonus,duration,target);
 return public.lothuus_hosting_report();
end; $$;
create or replace function public.lothuus_hosting_order_status(order_id uuid,next_status text) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if next_status not in ('payment_review','cancelled') then raise exception 'Invalid status';end if;
 update app_private.hosting_orders set status=next_status where id=order_id and status='pending_payment';
 return public.lothuus_hosting_report();
end; $$;
-- No HTTP owner endpoint exposes this function. Use the separate operator CLI after bank/provisioning checks.
create or replace function public.lothuus_hosting_activate(order_id uuid,operator_name text,receipt_reference text,provisioned boolean default false) returns jsonb language plpgsql security invoker set search_path='' as $$
declare o app_private.hosting_orders; current_account app_private.hosting_account;
begin
 if length(trim(operator_name))<2 or length(trim(receipt_reference))<3 then raise exception 'Bank receipt and operator required';end if;
 select * into current_account from app_private.hosting_account where id for update;
 select * into o from app_private.hosting_orders where id=order_id for update;
 if not found then raise exception 'Unknown order';end if;
 if o.status='active' then return public.lothuus_hosting_report();end if;
 if o.status='cancelled' then raise exception 'Cancelled order; review late payment separately';end if;
 if o.extra>0 then insert into app_private.hosting_entitlements(order_id,extra) values(o.id,o.extra) on conflict do nothing;
 else
 if not provisioned then raise exception 'Confirm provisioned infrastructure first';end if;
 if current_account.valid_until>now() and current_account.plan<>o.target_plan then raise exception 'Active plan differs; reconcile remaining term first';end if;
 update app_private.hosting_account set plan=o.target_plan,valid_until=greatest(now(),coalesce(valid_until,now()))+make_interval(months=>o.months),updated_at=now() where id;
 end if;
 update app_private.hosting_orders set status='active',activated_at=now(),confirmed_by=operator_name,bank_reference=receipt_reference where id=o.id;
 return public.lothuus_hosting_report();
end; $$;

create or replace function public.lothuus_hosting_claim(job_id uuid,force_refresh boolean default false) returns jsonb language plpgsql security invoker set search_path='' as $$
declare j app_private.hosting_jobs;
begin
 select * into j from app_private.hosting_jobs where id for update;
 if j.lease_until>now() or (not force_refresh and j.last_completed>now()-interval '1 hour') then return null;end if;
 update app_private.hosting_jobs set lease_id=job_id,lease_until=now()+interval '3 minutes',scan_id=coalesce(scan_id,gen_random_uuid()),scan_started=coalesce(scan_started,now()) where id returning * into j;
 return to_jsonb(j);
end; $$;
create or replace function public.lothuus_hosting_media(records jsonb) returns void language plpgsql security invoker set search_path='' as $$
begin
 if jsonb_array_length(records)>1000 then raise exception 'Batch too large';end if;
 insert into app_private.hosting_media_objects(key,bytes) select r->>'key',(r->>'bytes')::bigint from jsonb_array_elements(records) r
 on conflict(key) do update set bytes=excluded.bytes,updated_at=now();
 -- Keep the last reconciled total current for successful new uploads, without scans.
 update app_private.hosting_metrics set value=(select coalesce(sum(bytes),0) from app_private.hosting_media_objects),measured_at=now() where metric='media' and status='ready';
end; $$;
create or replace function public.lothuus_hosting_scan_page(job_id uuid,records jsonb,next_cursor text) returns boolean language plpgsql security invoker set search_path='' as $$
declare j app_private.hosting_jobs;
begin
 select * into j from app_private.hosting_jobs where id for update;
 if j.lease_id is distinct from job_id or j.lease_until<now() then raise exception 'Lease expired';end if;
 if jsonb_array_length(records)>1000 then raise exception 'Batch too large';end if;
 insert into app_private.hosting_media_objects(key,bytes,scan_id) select r->>'key',(r->>'bytes')::bigint,j.scan_id from jsonb_array_elements(records) r
 on conflict(key) do update set bytes=excluded.bytes,scan_id=j.scan_id,updated_at=now();
 update app_private.hosting_jobs set scan_cursor=next_cursor where id;
 if next_cursor is null then
 delete from app_private.hosting_media_objects where scan_id is distinct from j.scan_id and updated_at<j.scan_started;
 update app_private.hosting_metrics set value=(select coalesce(sum(bytes),0) from app_private.hosting_media_objects),measured_at=now(),status='ready' where metric='media';
 update app_private.hosting_jobs set scan_id=null,scan_started=null,scan_cursor=null where id;
 end if;
 return next_cursor is null;
end; $$;
create or replace function public.lothuus_hosting_finish(job_id uuid,results jsonb,scan_complete boolean) returns void language plpgsql security invoker set search_path='' as $$
declare m jsonb;
begin
 perform 1 from app_private.hosting_jobs where id and lease_id=job_id and lease_until>now() for update;
 if not found then raise exception 'Lease expired';end if;
 for m in select value from jsonb_array_elements(results) loop
 if m->>'metric' not in ('database','direct','media') then raise exception 'Invalid metric';end if;
 update app_private.hosting_metrics set value=case when m->>'status'='ready' then (m->>'value')::bigint else value end,
 measured_at=case when m->>'status'='ready' then now() else measured_at end,status=m->>'status',
 period_start=case when m->>'status'='ready' then (m->>'periodStart')::timestamptz else period_start end,
 period_end=case when m->>'status'='ready' then (m->>'periodEnd')::timestamptz else period_end end where metric=m->>'metric';
 end loop;
 update app_private.hosting_jobs set lease_until=null,lease_id=null,last_completed=case when scan_complete then now() else last_completed end where id;
 delete from app_private.hosting_usage_daily where day<current_date-400;
end; $$;
create or replace function public.lothuus_hosting_database_bytes() returns bigint language sql stable security invoker set search_path='' as $$
 select sum(pg_database_size(datname))::bigint from pg_database;
$$;
create or replace function public.lothuus_hosting_traffic(days jsonb) returns void language plpgsql security invoker set search_path='' as $$
begin
 if jsonb_array_length(days)>31 then raise exception 'Too many days';end if;
 insert into app_private.hosting_usage_daily(day,bytes) select (d->>'day')::date,(d->>'bytes')::bigint from jsonb_array_elements(days)d
 on conflict(day) do update set bytes=excluded.bytes,measured_at=now();
end; $$;
-- Explicitly lock down every table and routine, including trigger functions.
do $$ declare t text; f record;begin
 foreach t in array array['hosting_account','hosting_orders','hosting_entitlements','hosting_media_objects','hosting_metrics','hosting_jobs','hosting_usage_daily'] loop
 execute format('alter table app_private.%I enable row level security',t);
 execute format('revoke all on app_private.%I from public,anon,authenticated',t);
 execute format('grant select,insert,update,delete on app_private.%I to service_role',t);
 end loop;
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname like 'lothuus_hosting_%') or (n.nspname='app_private' and p.proname='hosting_store_count') loop
 execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
 end loop;
end; $$;
commit;
