create or replace function public.lothuus_state_stamp() returns text
language sql stable security invoker set search_path = '' as $$
 select revision::text || case when exists(
  select 1 from jsonb_array_elements(body->'reservations') r where r->>'status'='active'
 ) then ':' || floor(extract(epoch from now()) / 60)::bigint::text else '' end
 from app_private.store where id;
$$;
revoke all on function public.lothuus_state_stamp() from public,anon,authenticated;
grant execute on function public.lothuus_state_stamp() to service_role;
