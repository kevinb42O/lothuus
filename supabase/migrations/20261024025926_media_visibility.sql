create or replace function public.lothuus_photo_is_public(photo_id uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
 select exists (
 select 1 from app_private.store s,
 lateral jsonb_array_elements(s.body->'items') product,
 lateral jsonb_array_elements(product->'photos') photo
 where s.id and product->>'publication'='published' and photo->>'id'=photo_id::text
 );
$$;
revoke all on function public.lothuus_photo_is_public(uuid) from public,anon,authenticated;
grant execute on function public.lothuus_photo_is_public(uuid) to service_role;
