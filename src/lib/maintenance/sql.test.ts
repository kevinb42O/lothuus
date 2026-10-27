import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { initialStore } from '../backend/repository';
import { catalogue } from '../backend/service';
import type { Store } from '../backend/types';
import { backupTables, validateBackup } from './backup-format';

async function database() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema cron;create table cron.job(jobid serial primary key,jobname text unique,command text);
    create table cron.job_run_details(end_time timestamptz);
    create function cron.schedule(text,text,text) returns bigint language sql as $$insert into cron.job(jobname,command)values($1,$3)on conflict(jobname)do update set command=$3 returning jobid::bigint$$;`);
  for (const file of readdirSync('supabase/migrations').sort()) {
    if (file.includes('restrict_platform_trigger')) continue;
    const sql = readFileSync('supabase/migrations/' + file,'utf8')
      .replace(/create extension if not exists pg_cron with schema pg_catalog;/g,'')
      .replace(/do \$\$ begin\n  if not exists\(select 1 from pg_extension where extname='pg_cron'\)[\s\S]*?end; \$\$;/,'');
    await db.exec(sql);
  }
  return db;
}

test('PostgreSQL projections, report windows, ingest budgets, retention and complete backup restoration', { timeout: 60000 }, async t => {
  const db = await database();
  const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<{ value: T }>(sql,params)).rows[0].value;
  try {
    const item = randomUUID(), photo = randomUUID(), order = randomUUID();
    const state = initialStore();
    state.items = [{ id:item,sourceReference:'K001',productNumber:'K1',title:'Object',category:'keramiek',description:'PRIVATE DRAFT',date:'',material:'',dimensions:'',maker:'',condition:'',priceCents:1000,publication:'draft',photos:[{id:photo,alt:'Foto'}],sourcePhotos:[{id:photo,alt:'PRIVATE ORIGINAL METADATA'}],version:1,createdAt:new Date().toISOString() }];
    state.customers.push({id:randomUUID(),name:'PRIVATE CUSTOMER',email:'private@example.test',phone:'',channel:'email',notes:'PRIVATE NOTES',createdAt:''});
    state.requests = { private: { hash:'SECRET HASH',token:'PRIVATE CAPABILITY',reservationId:order } };
    await db.query('update app_private.store set body=$1 where id',[JSON.stringify(state)]);
    await db.query('insert into app_private.media(id,original_key,width,height,bytes)values($1,$2,100,100,100)',[photo,'originals/'+photo]);
    await db.query('insert into app_private.product_numbers(number,item_id)values($1,$2)',['K1',item]);

    await t.test('catalogue inputs exclude private business data and unfinished content', async () => {
      const projected = await one<Store>('select public.lothuus_catalogue_projection() as value');
      assert.equal(projected.items.length,1);
      const serialized = JSON.stringify(projected);
      for (const secret of ['PRIVATE CUSTOMER','private@example.test','PRIVATE CAPABILITY','SECRET HASH','PRIVATE DRAFT','PRIVATE ORIGINAL METADATA']) assert.equal(serialized.includes(secret),false,secret);
      assert.ok(catalogue(projected).objects.some(o=>o.id==='K001'));
    });

    await t.test('Free SQL responses remain bounded, and paid windows retain latest metadata', async () => {
      await db.exec(`insert into app_private.heart_objects values('K001','{"id":"K001","title":"Object"}'),('K002','{"id":"K002","title":"Older"}');
        insert into app_private.heart_days(day,object_id,added)values(current_date,'K001',2),(current_date-100,'K002',7);`);
      const free = await one<{days:unknown[];plan:string}>('select public.lothuus_heart_report_window(current_date-200,current_date) as value');
      assert.equal(free.plan,'basis');assert.equal(free.days.length,1);
      await db.exec("update app_private.hosting_account set plan='pro',valid_until=now()+interval '1 month' where id");
      const paid = await one<{days:unknown[];latest:{id:string;day:string}[]}>('select public.lothuus_heart_report_window(current_date-6,current_date) as value');
      assert.equal(paid.days.length,1);assert.ok(paid.latest.some(d=>d.id==='K002'));
    });

    await t.test('a global daily ceiling remains hard and idempotent retries keep their count', async () => {
      await db.exec('update app_private.analytics_config set daily_limit=100 where id');
      const ids = Array.from({length:100},()=>randomUUID());
      for (const id of ids) assert.equal((await one<{accepted:boolean}>('select public.lothuus_analytics_visit_budgeted($1,$2) as value',[id,'desktop'])).accepted,true);
      const limited = await one<{limited:boolean;resetAt:string}>('select public.lothuus_analytics_visit_budgeted($1,$2) as value',[randomUUID(),'desktop']);
      assert.equal(limited.limited,true);assert.ok(Date.parse(limited.resetAt)>Date.now());
      assert.equal((await one<{accepted:boolean}>('select public.lothuus_analytics_visit_budgeted($1,$2) as value',[ids[0],'desktop'])).accepted,true);
      assert.equal(Number(await one('select sum(visits) as value from app_private.analytics_days')),100);
      assert.equal(Number(await one('select count(*) as value from app_private.analytics_events')),100);
    });

    await t.test('leases, failures and once-per-day completion are durable', async () => {
      assert.equal(await one('select public.lothuus_maintenance_claim($1,$2) as value',['backup',order]),true);
      assert.equal(await one('select public.lothuus_maintenance_claim($1,$2) as value',['backup',randomUUID()]),false);
      await db.query('select public.lothuus_maintenance_finish($1,$2,true,$3)',['backup',order,'{"bytes":123}']);
      assert.equal(await one('select public.lothuus_maintenance_claim($1,$2) as value',['backup',randomUUID()]),false);
    });

    await t.test('backup includes paid entitlements and statistics and restores into a clean PostgreSQL schema', async () => {
      await db.query("insert into app_private.hosting_orders(id,product,cents,status,payload,extra)values($1,'extra50',2500,'active','payload',50)",[order]);
      await db.query('insert into app_private.hosting_entitlements(order_id,extra)values($1,50)',[order]);
      const backup = validateBackup(await one('select public.lothuus_backup_state() as value'));
      assert.equal(backup.tables.hosting_entitlements.length,1);assert.equal(backup.tables.analytics_days.length,1);
      assert.equal('analytics_events' in backup.tables,false);assert.equal('heart_browsers' in backup.tables,false);
      const restored = await database();
      try {
        await restored.exec(`truncate ${backupTables.map(name=>'app_private.'+name).join(',')} cascade`);
        for (const name of backupTables) await restored.query(`insert into app_private.${name} select * from jsonb_populate_recordset(null::app_private.${name},$1::jsonb)`,[JSON.stringify(backup.tables[name])]);
        const recovered = validateBackup((await restored.query<{value:unknown}>('select public.lothuus_backup_state() as value')).rows[0].value);
        for (const name of backupTables) assert.deepEqual(recovered.tables[name],backup.tables[name],name);
      } finally { await restored.close(); }
    });

    await t.test('event and Cron retention preserve daily totals and recent operational history', async () => {
      await db.exec("update app_private.analytics_events set accepted_at=now()-interval '3 days';select public.lothuus_analytics_cleanup();insert into cron.job_run_details values(now()-interval '10 days'),(now());");
      assert.equal(Number(await one('select count(*) as value from app_private.analytics_events')),0);
      assert.equal(Number(await one('select sum(visits) as value from app_private.analytics_days')),100);
      const command = await one<string>("select command as value from cron.job where jobname='lothuus-cron-log-retention'");await db.exec(command);
      assert.equal(Number(await one('select count(*) as value from cron.job_run_details')),1);
    });

    await t.test('ordinary roles cannot invoke any maintenance or projection function', async () => {
      await db.exec('set role anon');
      for (const sql of ['select public.lothuus_catalogue_projection()', 'select public.lothuus_backup_state()', 'select public.lothuus_operations_report()', 'select public.lothuus_heart_report_window(current_date,current_date)']) await assert.rejects(db.exec(sql),/permission denied/);
      await db.exec('reset role');
    });
  } finally { await db.close(); }
});

test('Postgres permits 297 objects on the unchanged 200-object package and classifies I/P/T order hearts', { timeout: 60000 }, async () => {
  const db = await database();
  try {
    const state = initialStore();
    state.items = Array.from({ length: 297 }, (_, index) => ({
      id: randomUUID(), title: 'Testobject', category: 'objecten', description: '', priceCents: 0, priceUnset: true,
      date: '', material: '', dimensions: '', maker: '', condition: '', publication: 'draft', photos: [], version: 1, createdAt: new Date().toISOString(),
      ...(index < 3 ? { sourceReference: ['I001','P001','T001'][index], productNumber: ['I1','P1','T1'][index] } : {}),
    }));
    const loaded = (await db.query<{ revision: number }>('select revision from app_private.store where id')).rows[0];
    assert.equal((await db.query<{ ok: boolean }>('select public.lothuus_commit_state($1,$2) as ok', [loaded.revision, JSON.stringify(state)])).rows[0].ok, true);
    const report = (await db.query<{ report: { count: number; limit: number; plan: string } }>('select public.lothuus_hosting_report() as report')).rows[0].report;
    assert.equal(report.count, 297); assert.equal(report.limit, 200); assert.equal(report.plan, 'basis');
    state.items[0].title = 'Ook boven de limiet bewerkbaar';
    await db.query('update app_private.store set body=$1 where id', [JSON.stringify(state)]);
    const capability = 'a'.repeat(64), browser = 'b'.repeat(64);
    state.reservations = [{ tokenHash: capability, source: 'web', lines: state.items.slice(0,3).map(i => ({ itemId: i.id, title: i.title, productNumber: i.productNumber, image: '' })) }] as unknown as Store['reservations'];
    await db.query('update app_private.store set body=$1 where id', [JSON.stringify(state)]);
    await db.exec('update app_private.heart_settings set enabled=true where id');
    await db.query('select public.lothuus_heart_order($1,$2,1)', [browser, capability]);
    const rows = (await db.query<{ id: string; snapshot: { source: string } }>('select id,snapshot from app_private.heart_objects order by id')).rows;
    assert.deepEqual(rows.map(r => [r.id, r.snapshot.source]), [['I001','collection'],['P001','collection'],['T001','collection']]);
    await db.exec('set role anon');
    await assert.rejects(db.query('select public.lothuus_heart_order($1,$2,2)', [browser, capability]), /permission denied/);
  } finally { await db.close(); }
});
