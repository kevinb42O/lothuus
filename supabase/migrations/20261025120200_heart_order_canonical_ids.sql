-- Imported products keep their original collection identity after publication.
begin;
create or replace function public.lothuus_heart_order(browser_key text, capability_hash text, client_sequence bigint) returns void
language plpgsql security invoker set search_path = '' as $$
declare reservation jsonb; line jsonb; object_key text;
begin
 if not (select enabled from app_private.heart_settings where id) then return; end if;
 select value into reservation from app_private.store cross join lateral jsonb_array_elements(body->'reservations') where value->>'tokenHash'=capability_hash and value->>'source'='web';
 if reservation is null then return; end if;
 perform 1 from app_private.heart_browsers where hash=browser_key for update;
 for line in select value from jsonb_array_elements(coalesce(reservation->'lines',jsonb_build_array(jsonb_build_object('itemId',reservation->>'itemId')))) loop
  select coalesce(value->>'sourceReference', value->>'id') into object_key from app_private.store cross join lateral jsonb_array_elements(body->'items') where value->>'id'=line->>'itemId';
  object_key := coalesce(object_key, line->>'itemId');
  update app_private.heart_states set selected=false,sequence=client_sequence where browser_hash=browser_key and object_id=object_key and selected and sequence < client_sequence;
  if found then
   insert into app_private.heart_days(day,object_id,ordered) values((now() at time zone 'Europe/Brussels')::date,object_key,1)
   on conflict(day,object_id) do update set ordered=heart_days.ordered+1;
  end if;
 end loop;
end; $$;
revoke all on function public.lothuus_heart_order(text,text,bigint) from public,anon,authenticated;
grant execute on function public.lothuus_heart_order(text,text,bigint) to service_role;
commit;
