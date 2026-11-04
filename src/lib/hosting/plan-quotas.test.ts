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
    // Reapplying this migration must preserve the currently installed capacity policy.
    const before = (await db.query<{ definition: string }>("select pg_get_functiondef('app_private.hosting_check_capacity()'::regprocedure) as definition")).rows[0].definition;
    await db.exec(readFileSync('supabase/migrations/20261027120000_service_plan_quotas.sql', 'utf8'));
    const after = (await db.query<{ definition: string }>("select pg_get_functiondef('app_private.hosting_check_capacity()'::regprocedure) as definition")).rows[0].definition;
    assert.equal(after, before);

    // Exercise the real capacity trigger without product-number/media triggers.
    await db.exec(`create table capacity_probe(body jsonb);
      create trigger capacity_probe before update of body on capacity_probe for each row execute function app_private.hosting_check_capacity();`);
    const body = (count: number, title = 'Bewaard') => JSON.stringify({ items: Array.from({ length: count }, (_, index) => ({ id: index, title })) });
    const write = (count: number, title?: string) => db.query('update capacity_probe set body=$1::jsonb', [body(count, title)]);
    const count = async () => (await db.query<{ n: number }>("select jsonb_array_length(body->'items') as n from capacity_probe")).rows[0].n;
    // Free + an activated 50-object expansion permits exactly 250 records.
    await db.query('insert into capacity_probe values ($1::jsonb)', [body(249)]);
    await write(250);
    await assert.rejects(write(251), /HOSTING_OBJECT_LIMIT/);
    assert.equal(await count(), 250);
    await write(250, 'Gewijzigd');
    // A pre-existing 304-item collection survives installing/reapplying enforcement.
    await db.exec('delete from capacity_probe');
    await db.query('insert into capacity_probe values ($1::jsonb)', [body(304)]);
    await db.exec(readFileSync('supabase/migrations/20261104120000_enforce_object_capacity.sql', 'utf8'));
    assert.equal(await count(), 304);
    await write(304, 'Bestaand product bewerkt');
    await assert.rejects(write(305), /HOSTING_OBJECT_LIMIT/);
    assert.equal(await count(), 304);
    await db.exec("update app_private.hosting_account set plan='pro',valid_until=now()+interval '1 month' where id");
    await write(305);
    // Expiry restores Free + expansion; existing records can still be edited.
    await db.exec("update app_private.hosting_account set valid_until=now()-interval '1 day' where id");
    await write(305, 'Na vervallen abonnement');
    await assert.rejects(write(306), /HOSTING_OBJECT_LIMIT/);
  } finally { await db.close(); }
});
