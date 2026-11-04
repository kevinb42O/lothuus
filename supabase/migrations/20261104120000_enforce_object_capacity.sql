begin;

-- Existing over-limit collections remain editable. Only growth is refused.
create or replace function app_private.hosting_check_capacity() returns trigger
language plpgsql security invoker set search_path='' as $$
declare a app_private.hosting_account; capacity integer; bonus integer;
begin
 if jsonb_array_length(new.body->'items')<=jsonb_array_length(old.body->'items') then return new; end if;
 select * into a from app_private.hosting_account where id for update;
 if not found then raise exception 'HOSTING_ACCOUNT_UNAVAILABLE'; end if;
 select coalesce(sum(extra),0) into bonus from app_private.hosting_entitlements;
 capacity:=case
  when a.plan='premium' and a.valid_until>now() then 5000
  when a.plan='pro' and a.valid_until>now() then 1000
  else 200
 end + bonus;
 if jsonb_array_length(new.body->'items')>capacity then raise exception 'HOSTING_OBJECT_LIMIT'; end if;
 return new;
end; $$;

revoke all on function app_private.hosting_check_capacity() from public,anon,authenticated;
grant execute on function app_private.hosting_check_capacity() to service_role;

commit;
