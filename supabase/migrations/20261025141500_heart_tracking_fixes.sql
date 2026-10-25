begin;
-- A retired product can still be deselected; it reuses its stored public snapshot.
-- Sequence checks precede snapshot updates so an old retry cannot overwrite newer metadata.
create or replace function public.lothuus_heart_write(browser_key text, actions jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare a jsonb; previous app_private.heart_states%rowtype; did_exist boolean; is_selected boolean; seq bigint; object_key text; is_baseline boolean;
begin
 if length(browser_key) <> 64 or jsonb_typeof(actions) <> 'array' or jsonb_array_length(actions) > 100 then raise exception 'Invalid heart batch'; end if;
 if not (select enabled from app_private.heart_settings where id) then return; end if;
 perform public.lothuus_heart_cleanup();
 insert into app_private.heart_browsers(hash) values(browser_key) on conflict(hash) do update set seen_at=now();
 perform 1 from app_private.heart_browsers where hash=browser_key for update;
 for a in select value from jsonb_array_elements(actions) loop
  object_key := a->>'id'; seq := (a->>'sequence')::bigint;
  is_selected := (a->>'selected')::boolean; is_baseline := coalesce((a->>'baseline')::boolean,false);
  if length(object_key) > 128 or seq < 0 then raise exception 'Invalid heart action'; end if;
  select * into previous from app_private.heart_states where browser_hash=browser_key and object_id=object_key;
  did_exist := found;
  if did_exist and previous.sequence >= seq then continue; end if;
  if a->'object' is not null and a->'object' <> 'null'::jsonb then
   insert into app_private.heart_objects(id,snapshot) values(object_key,a->'object') on conflict(id) do update set snapshot=excluded.snapshot;
  elsif is_selected or not exists(select 1 from app_private.heart_objects where id=object_key) then
   continue;
  end if;
  if not is_baseline and is_selected is distinct from (case when did_exist then previous.selected else false end) then
   insert into app_private.heart_days(day,object_id,added,removed)
    values((now() at time zone 'Europe/Brussels')::date,object_key,case when is_selected then 1 else 0 end,case when is_selected then 0 else 1 end)
    on conflict(day,object_id) do update set added=heart_days.added+excluded.added,removed=heart_days.removed+excluded.removed;
  end if;
  insert into app_private.heart_states(browser_hash,object_id,selected,sequence) values(browser_key,object_key,is_selected,seq)
   on conflict(browser_hash,object_id) do update set selected=excluded.selected,sequence=excluded.sequence;
 end loop;
end; $$;
-- Store a false state even if the earlier add is still in flight. Otherwise it could revive
-- a selected object after checkout. The confirmed order supplies the snapshot if needed.
create or replace function public.lothuus_heart_order(browser_key text, capability_hash text, client_sequence bigint) returns void
language plpgsql security invoker set search_path = '' as $$
declare reservation jsonb; line jsonb; product jsonb; object_key text; previous app_private.heart_states%rowtype; did_exist boolean;
begin
 if not (select enabled from app_private.heart_settings where id) then return; end if;
 select value into reservation from app_private.store cross join lateral jsonb_array_elements(body->'reservations') where value->>'tokenHash'=capability_hash and value->>'source'='web';
 if reservation is null then return; end if;
 insert into app_private.heart_browsers(hash) values(browser_key) on conflict(hash) do update set seen_at=now();
 perform 1 from app_private.heart_browsers where hash=browser_key for update;
 for line in select value from jsonb_array_elements(coalesce(reservation->'lines',jsonb_build_array(jsonb_build_object('itemId',reservation->>'itemId','title',reservation->>'title','image',reservation->>'image')))) loop
  select value into product from app_private.store cross join lateral jsonb_array_elements(body->'items') where value->>'id'=line->>'itemId' or value->>'sourceReference'=line->>'itemId' limit 1;
  object_key := coalesce(product->>'sourceReference',product->>'id',line->>'itemId');
  select * into previous from app_private.heart_states where browser_hash=browser_key and object_id=object_key;
  did_exist := found;
  if did_exist and previous.sequence >= client_sequence then continue; end if;
  insert into app_private.heart_objects(id,snapshot) values(object_key,jsonb_build_object('id',object_key,'title',coalesce(line->>'title','Object'),'reference',coalesce(line->>'productNumber',object_key),'image',coalesce(line->>'image',''),'category',coalesce(product->>'category','objecten'),'source',case when object_key ~ '^[KGH][0-9]{3}$' then 'collection' else 'inventory' end)) on conflict(id) do nothing;
  insert into app_private.heart_states(browser_hash,object_id,selected,sequence) values(browser_key,object_key,false,client_sequence)
   on conflict(browser_hash,object_id) do update set selected=false,sequence=excluded.sequence;
  if did_exist and previous.selected then
   insert into app_private.heart_days(day,object_id,ordered) values((now() at time zone 'Europe/Brussels')::date,object_key,1)
   on conflict(day,object_id) do update set ordered=heart_days.ordered+1;
  end if;
 end loop;
end; $$;
revoke all on function public.lothuus_heart_write(text,jsonb), public.lothuus_heart_order(text,text,bigint) from public,anon,authenticated;
grant execute on function public.lothuus_heart_write(text,jsonb), public.lothuus_heart_order(text,text,bigint) to service_role;
commit;
