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
 delete from app_private.stock_claims where item_id is not null;
 for reservation in select value from jsonb_array_elements(next_state->'reservations') where value->>'status' in ('active','completed') loop
  for line in select value from jsonb_array_elements(coalesce(reservation->'lines',jsonb_build_array(jsonb_build_object('itemId',reservation->>'itemId')))) loop
   insert into app_private.stock_claims(item_id,reservation_id,state) values(line->>'itemId',(reservation->>'id')::uuid,reservation->>'status');
  end loop;
 end loop;
 update app_private.store set body=next_state, revision=revision+1, updated_at=now() where id;
 return true;
end; $$;
create or replace function public.lothuus_backup_state() returns jsonb
language sql security invoker set search_path = '' as $$
 select jsonb_build_object('schemaVersion',1,'createdAt',now(),
 'store',(select jsonb_build_object('revision',revision,'state',body) from app_private.store where id),
 'media',coalesce((select jsonb_agg(to_jsonb(m)) from app_private.media m),'[]'),
 'productNumbers',coalesce((select jsonb_agg(to_jsonb(n)) from app_private.product_numbers n),'[]'));
$$;
revoke all on function public.lothuus_backup_state() from public,anon,authenticated;
grant execute on function public.lothuus_backup_state() to service_role;
