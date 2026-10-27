import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { PLANS } from './catalogue';

test('SQL plan rights match the catalogue and retain expansions and expiry behavior', { timeout: 60000 }, async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create schema cron;create table cron.job(jobid serial primary key,jobname text unique,command text);
      create table cron.job_run_details(end_time timestamptz);
      create function cron.schedule(text,text,text) returns bigint language sql as $$insert into cron.job(jobname,command)values($1,$3)on conflict(jobname)do update set command=$3 returning jobid::bigint$$;`);
    for (const file of readdirSync('supabase/migrations').sort()) {
      if (file.includes('restrict_platform_trigger')) continue;
      const sql = readFileSync('supabase/migrations/' + file, 'utf8')
        .replace(/create extension if not exists pg_cron with schema pg_catalog;/g, '')
        .replace(/do \$\$ begin\n  if not exists\(select 1 from pg_extension where extname='pg_cron'\)[\s\S]*?end; \$\$;/, '');
      await db.exec(sql);
    }
    const report = async () => (await db.query<{ value: { plan: string; limit: number } }>('select public.lothuus_hosting_report() as value')).rows[0].value;
    for (const [plan, expected] of Object.entries(PLANS)) {
      await db.query("update app_private.hosting_account set plan=$1,valid_until=now()+interval '1 month' where id", [plan]);
      assert.equal((await report()).limit, expected.objects);
    }
    await db.exec(`insert into app_private.hosting_orders(id,product,cents,status,payload,extra) values ('00000000-0000-4000-8000-000000000001','extra50',2500,'active','payload',50);
      insert into app_private.hosting_entitlements(order_id,extra) values ('00000000-0000-4000-8000-000000000001',50);`);
    assert.equal((await report()).limit, PLANS.premium.objects + 50);
    await db.exec("update app_private.hosting_account set valid_until=now()-interval '1 day' where id");
    assert.equal((await report()).plan, 'basis');
    assert.equal((await report()).limit, PLANS.basis.objects + 50);
    // Reapplying this migration must preserve an installed advisory capacity policy.
    const before = (await db.query<{ definition: string }>("select pg_get_functiondef('app_private.hosting_check_capacity()'::regprocedure) as definition")).rows[0].definition;
    await db.exec(readFileSync('supabase/migrations/20261027120000_service_plan_quotas.sql', 'utf8'));
    const after = (await db.query<{ definition: string }>("select pg_get_functiondef('app_private.hosting_check_capacity()'::regprocedure) as definition")).rows[0].definition;
    assert.equal(after, before);
  } finally { await db.close(); }
});
