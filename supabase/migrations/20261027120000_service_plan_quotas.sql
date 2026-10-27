begin;

-- Business retains the premium key so existing orders and payment references remain valid.
create or replace function public.lothuus_hosting_report() returns jsonb
language sql stable security invoker set search_path='' as $$
 with a as (
  select *, case when plan<>'basis' and valid_until>now() then plan else 'basis' end as active_plan
  from app_private.hosting_account where id
 ), e as (
  select coalesce(sum(extra),0) as extra from app_private.hosting_entitlements
 )
 select jsonb_build_object(
  'plan',a.active_plan,
  'extra',e.extra,
  'count',a.object_count,
  'limit',(case a.active_plan when 'premium' then 5000 when 'pro' then 1000 else 200 end)+e.extra,
  'validUntil',a.valid_until,
  'updatedAt',now(),
  'metrics',coalesce((
   select jsonb_object_agg(metric,jsonb_build_object(
    'value',value,'measuredAt',measured_at,'status',status,
    'periodStart',period_start,'periodEnd',period_end
   )) from app_private.hosting_metrics
  ),'{}') || jsonb_build_object(
   'cached',jsonb_build_object('value',null,'measuredAt',null,'status','not_applicable')
  ),
  'orders',coalesce((
   select jsonb_agg(row_to_json(o) order by o."createdAt" desc)
   from (
    select id,product,cents,status,created_at as "createdAt",activated_at as "activatedAt"
    from app_private.hosting_orders order by created_at desc limit 30
   ) o
  ),'[]')
 ) from a cross join e;
$$;

-- Preserve the currently installed capacity policy, including advisory-only policies.
-- Only adjust the older hard-limit implementation when those exact clauses exist.
do $$
declare definition text;
begin
 definition := pg_get_functiondef('app_private.hosting_check_capacity()'::regprocedure);
 definition := replace(definition, 'when a.plan=''premium'' and a.valid_until>now() then 1000', 'when a.plan=''premium'' and a.valid_until>now() then 5000');
 definition := replace(definition, 'when a.plan=''pro'' and a.valid_until>now() then 500', 'when a.plan=''pro'' and a.valid_until>now() then 1000');
 execute definition;
end; $$;

commit;
