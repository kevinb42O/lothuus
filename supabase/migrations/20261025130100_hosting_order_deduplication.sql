begin;
create unique index if not exists hosting_one_open_product on app_private.hosting_orders(product) where status in ('pending_payment','payment_review');
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
 insert into app_private.hosting_orders(id,product,cents,payload,extra,months,target_plan) values(order_id,product_code,price,expected,bonus,duration,target) on conflict do nothing;
 return public.lothuus_hosting_report();
end; $$;
revoke all on function public.lothuus_hosting_order(uuid,text,text) from public,anon,authenticated;
grant execute on function public.lothuus_hosting_order(uuid,text,text) to service_role;
commit;
