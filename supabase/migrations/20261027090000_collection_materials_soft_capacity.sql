begin;
-- Object capacity is advisory, by owner request. Keep independent count/usage tracking.
create or replace function app_private.hosting_check_capacity() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 return new;
end; $$;
revoke all on function app_private.hosting_check_capacity() from public,anon,authenticated;
grant execute on function app_private.hosting_check_capacity() to service_role;

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
  insert into app_private.heart_objects(id,snapshot) values(object_key,jsonb_build_object('id',object_key,'title',coalesce(line->>'title','Object'),'reference',coalesce(line->>'productNumber',object_key),'image',coalesce(line->>'image',''),'category',coalesce(product->>'category','objecten'),'source',case when object_key ~ '^[KPGTHI][0-9]{3}$' then 'collection' else 'inventory' end)) on conflict(id) do nothing;
  insert into app_private.heart_states(browser_hash,object_id,selected,sequence) values(browser_key,object_key,false,client_sequence)
   on conflict(browser_hash,object_id) do update set selected=false,sequence=excluded.sequence;
  if did_exist and previous.selected then
   insert into app_private.heart_days(day,object_id,ordered) values((now() at time zone 'Europe/Brussels')::date,object_key,1)
   on conflict(day,object_id) do update set ordered=heart_days.ordered+1;
  end if;
 end loop;
end; $$;
revoke all on function public.lothuus_heart_order(text,text,bigint) from public,anon,authenticated;
grant execute on function public.lothuus_heart_order(text,text,bigint) to service_role;
commit;
