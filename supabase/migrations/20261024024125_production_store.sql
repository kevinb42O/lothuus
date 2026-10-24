begin;
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to service_role;
create table if not exists app_private.store (
 id boolean primary key default true check(id),
 revision bigint not null default 0,
 body jsonb not null check(body->>'schemaVersion' = '1'),
 updated_at timestamptz not null default now()
);
create table if not exists app_private.media (
 id uuid primary key,
 original_key text not null unique,
 width integer not null check(width > 0), height integer not null check(height > 0),
 bytes integer not null check(bytes > 0 and bytes <= 15000000),
 created_at timestamptz not null default now()
);
create table if not exists app_private.product_numbers (
 number text primary key check(number ~ '^[KPGTHI][1-9][0-9]*$'),
 item_id uuid not null,
 created_at timestamptz not null default now()
);
create table if not exists app_private.stock_claims (
 item_id text primary key,
 reservation_id uuid not null,
 state text not null check(state in ('active','completed'))
);
create table if not exists app_private.rate_limits (
 key text primary key, count integer not null, until_at timestamptz not null
);
alter table app_private.store enable row level security;
alter table app_private.media enable row level security;
alter table app_private.product_numbers enable row level security;
alter table app_private.stock_claims enable row level security;
alter table app_private.rate_limits enable row level security;
grant select,insert,update,delete on all tables in schema app_private to service_role;
insert into app_private.store(id,body) values(true,
 '{"schemaVersion":1,"items":[],"customers":[],"reservations":[],"emails":[],"requests":{},"limits":{},"settingsVersion":1,"settings":{"businessName":"LOTHUUS","ownerEmail":"katrien@lothuus.be","replyTo":"","beneficiary":"","iban":"","deadlineDays":3,"pickup":"Ophalen op afspraak. Neem contact op om een moment af te spreken.","terms":"","privacy":"","termsVersion":"1","reservationsEnabled":false,"requestsEnabled":false}}') on conflict(id) do nothing;
create or replace function public.lothuus_load_state() returns jsonb
language sql security invoker set search_path = '' as $$
 select jsonb_build_object('revision', revision, 'state', body) from app_private.store where id;
$$;
create or replace function public.lothuus_commit_state(expected_revision bigint, next_state jsonb) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare current_revision bigint; product jsonb; photo jsonb; num text; holder uuid; reservation jsonb; line jsonb;
begin
 select revision into current_revision from app_private.store where id for update;
 if current_revision <> expected_revision then return false; end if;
 if next_state->>'schemaVersion' <> '1' or jsonb_typeof(next_state->'items') <> 'array' or jsonb_typeof(next_state->'reservations') <> 'array' then
  raise exception 'Invalid store';
 end if;
 -- All identifiers, including previous material numbers, remain permanently claimed.
 for product in select value from jsonb_array_elements(next_state->'items') loop
  for num in select product->>'productNumber' where product ? 'productNumber'
   union select value from jsonb_array_elements_text(coalesce(product->'previousNumbers','[]')) loop
   insert into app_private.product_numbers(number,item_id) values(num,(product->>'id')::uuid) on conflict do nothing;
   select item_id into holder from app_private.product_numbers where number=num;
   if holder <> (product->>'id')::uuid then raise exception 'Product number already assigned'; end if;
  end loop;
  for photo in select value from jsonb_array_elements(product->'photos') loop
   if not exists(select 1 from app_private.media where id=(photo->>'id')::uuid) then raise exception 'Photo not ready'; end if;
  end loop;
 end loop;
 -- Database uniqueness also protects stock when two orders arrive at once.
 delete from app_private.stock_claims;
 for reservation in select value from jsonb_array_elements(next_state->'reservations') where value->>'status' in ('active','completed') loop
  for line in select value from jsonb_array_elements(coalesce(reservation->'lines',jsonb_build_array(jsonb_build_object('itemId',reservation->>'itemId')))) loop
   insert into app_private.stock_claims(item_id,reservation_id,state) values(line->>'itemId',(reservation->>'id')::uuid,reservation->>'status');
  end loop;
 end loop;
 update app_private.store set body=next_state, revision=revision+1, updated_at=now() where id;
 return true;
end; $$;
create or replace function public.lothuus_register_media(media_id uuid, original_key text, width integer, height integer, bytes integer) returns void
language sql security invoker set search_path = '' as $$
 insert into app_private.media(id,original_key,width,height,bytes) values(media_id,original_key,width,height,bytes);
$$;
create or replace function public.lothuus_rate_limit(bucket_key text, maximum integer, window_seconds integer) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare hits integer;
begin
 delete from app_private.rate_limits where until_at < now() - interval '1 day';
 insert into app_private.rate_limits(key,count,until_at) values(bucket_key,1,now()+make_interval(secs=>window_seconds))
 on conflict(key) do update set count=case when rate_limits.until_at < now() then 1 else rate_limits.count+1 end,
 until_at=case when rate_limits.until_at < now() then now()+make_interval(secs=>window_seconds) else rate_limits.until_at end
 returning count into hits;
 return hits <= maximum;
end; $$;
revoke all on function public.lothuus_load_state(), public.lothuus_commit_state(bigint,jsonb), public.lothuus_register_media(uuid,text,integer,integer,integer), public.lothuus_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.lothuus_load_state(), public.lothuus_commit_state(bigint,jsonb), public.lothuus_register_media(uuid,text,integer,integer,integer), public.lothuus_rate_limit(text,integer,integer) to service_role;
commit;
