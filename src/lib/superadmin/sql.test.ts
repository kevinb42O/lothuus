import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { initialStore } from "../backend/repository";
import { usageActions } from "../admin-usage";

test(
  "operator access, atomic activity, reversible policy, expiry and owner isolation",
  { timeout: 60000 },
  async () => {
    const db = new PGlite();
    try {
      await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema cron;create table cron.job(jobid serial primary key,jobname text unique,command text);
    create table cron.job_run_details(end_time timestamptz);
    create function cron.schedule(text,text,text) returns bigint language sql as $$insert into cron.job(jobname,command)values($1,$3)on conflict(jobname)do update set command=$3 returning jobid::bigint$$;`);
      for (const name of readdirSync("supabase/migrations").sort()) {
        if (name.includes("restrict_platform_trigger")) continue;
        await db.exec(
          readFileSync("supabase/migrations/" + name, "utf8")
            .replace(
              /create extension if not exists pg_cron with schema pg_catalog;/g,
              "",
            )
            .replace(
              /do \$\$ begin\n  if not exists\(select 1 from pg_extension where extname='pg_cron'\)[\s\S]*?end; \$\$;/,
              "",
            ),
        );
      }
      const operator = randomUUID(),
        owner = randomUUID();
      await db.query("select public.lothuus_operator_bootstrap($1)", [
        operator,
      ]);
      await db.query("select public.lothuus_operator_bootstrap($1)", [
        operator,
      ]);
      await assert.rejects(
        db.query("select public.lothuus_operator_bootstrap($1)", [owner]),
        /OPERATOR_ALREADY_CONFIGURED/,
      );
      const one = async <T>(sql: string, params: unknown[] = []) =>
        (await db.query<{ value: T }>(sql, params)).rows[0].value;
      const policy = () =>
        one<{ count: number; limit: number; enforced: boolean }>(
          "select public.lothuus_capacity_policy() as value",
        );
      const report = (before: string | null = null) =>
        one<{
          activity: {
            id: string;
            kind: string;
            actor: string;
            details: { fields?: string[] };
          }[];
        }>("select public.lothuus_operator_report($1,$2) as value", [
          operator,
          before,
        ]);
      const change = (
        version: number,
        enforced: boolean,
        limit: number | null = null,
        until: string | null = null,
      ) =>
        db.query("select public.lothuus_operator_policy($1,$2,$3,$4,$5,$6)", [
          operator,
          version,
          enforced,
          limit,
          until,
          "Geïsoleerde test",
        ]);
      assert.equal(
        await one("select public.lothuus_operator_enabled($1) as value", [
          owner,
        ]),
        false,
      );
      await assert.rejects(
        db.query("select public.lothuus_operator_report($1)", [owner]),
        /OPERATOR_FORBIDDEN/,
      );
      await assert.rejects(
        db.query(
          "select public.lothuus_operator_policy($1,1,false,null,null,$2)",
          [owner, "Verboden"],
        ),
        /OPERATOR_FORBIDDEN/,
      );
      assert.deepEqual(await policy(), {
        count: 0,
        limit: 200,
        enforced: true,
      });
      await change(1, false);
      assert.equal((await policy()).enforced, false);
      const state = initialStore();
      state.items = Array.from({ length: 201 }, (_, n) => ({
        id: randomUUID(),
        title: `Object ${n}`,
        description: "PRIVATE_DESCRIPTION",
        category: "objecten",
        date: "",
        material: "",
        dimensions: "",
        maker: "",
        condition: "",
        priceCents: 1000,
        publication: "draft",
        photos: [],
        version: 1,
        createdAt: new Date().toISOString(),
      })) as typeof state.items;
      const commit = async () => {
        const revision = await one<number>(
          "select revision as value from app_private.store where id",
        );
        return one<boolean>(
          "select public.lothuus_commit_state_audited($1,$2,$3) as value",
          [revision, JSON.stringify(state), owner],
        );
      };
      assert.equal(await commit(), true);
      assert.equal((await policy()).count, 201);
      const first = (await report()).activity;
      assert.equal(first.length, 50);
      assert.ok(
        first.every(
          (row, i) => i === 0 || BigInt(first[i - 1].id) > BigInt(row.id),
        ),
      );
      assert.ok(first.some((row) => row.kind === "product_created"));
      assert.equal(first[0].actor, "Eigenaar");
      assert.equal(
        JSON.stringify(first).includes("PRIVATE_DESCRIPTION"),
        false,
      );
      const next = (await report(first.at(-1)!.id)).activity;
      assert.ok(next.every((row) => BigInt(row.id) < BigInt(first.at(-1)!.id)));
      await change(2, true);
      state.items[0].title = "Gewijzigd boven de limiet";
      state.items[0].priceCents = 1250;
      assert.equal(await commit(), true);
      const updated = (await report()).activity[0];
      assert.equal(updated.kind, "product_updated");
      assert.ok(updated.details.fields?.includes("priceCents"));
      const beforeCount = await one<number>(
        "select count(*)::int as value from app_private.operator_activity",
      );
      assert.equal(await commit(), true);
      assert.equal(
        await one(
          "select count(*)::int as value from app_private.operator_activity",
        ),
        beforeCount,
      );
      state.items.push({ ...state.items[0], id: randomUUID() });
      await assert.rejects(commit(), /HOSTING_OBJECT_LIMIT/);
      assert.equal((await policy()).count, 201);
      assert.equal(
        await one(
          "select count(*)::int as value from app_private.operator_activity",
        ),
        beforeCount,
      );
      await change(3, true, 250, new Date(Date.now() + 3600000).toISOString());
      assert.equal(await commit(), true);
      assert.equal((await policy()).limit, 250);
      await db.exec(
        "update app_private.operator_settings set expires_at=now()-interval '1 minute' where id",
      );
      assert.deepEqual(await policy(), {
        count: 202,
        limit: 200,
        enforced: true,
      });
      await assert.rejects(change(3, false), /OPERATOR_VERSION_CONFLICT/);
      await db.query(
        "select public.lothuus_record_activity($1,'capacity_denied')",
        [owner],
      );
      await db.query(
        "select public.lothuus_record_activity($1,'capacity_denied')",
        [owner],
      );
      assert.equal(
        await one(
          "select count(*)::int as value from app_private.operator_activity where kind='capacity_denied'",
        ),
        1,
      );
      const order = randomUUID();
      await db.query(
        "insert into app_private.hosting_orders(id,product,cents,status,payload,extra) values($1,'extra50',2500,'payment_review','isolated-payload',50)",
        [order],
      );
      await db.query("select public.lothuus_operator_activate($1,$2,$3,true)", [
        operator,
        order,
        "Geïsoleerde bankreferentie",
      ]);
      await db.query("select public.lothuus_operator_activate($1,$2,$3,true)", [
        operator,
        order,
        "Geïsoleerde bankreferentie",
      ]);
      assert.equal((await policy()).limit, 250);
      assert.equal(
        await one(
          "select count(*)::int as value from app_private.operator_activity where kind='payment_activated'",
        ),
        1,
      );
      // Named usage events are deduplicated, operator-only and filterable.
      const usageEvent = {
        id: randomUUID(),
        action: "plan_pro",
        section: "hosting",
        product: "pro_month",
      };
      const usageBatch = [
        usageEvent,
        { id: randomUUID(), action: "usage_view", section: "hosting" },
      ];
      for (let i = 0; i < 2; i++)
        await db.query("select public.lothuus_admin_usage($1,$2)", [
          owner,
          JSON.stringify(usageBatch),
        ]);
      type Usage = {
        totals: { planClicks: number; usageViews: number; actions: number };
        events: { action: string }[];
      };
      const usage = await one<Usage>(
        "select public.lothuus_operator_usage($1) as value",
        [operator],
      );
      assert.equal(usage.totals.planClicks, 1);
      assert.equal(usage.totals.usageViews, 1);
      assert.equal(usage.totals.actions, 1);
      const packages = await one<Usage>(
        "select public.lothuus_operator_usage($1,30,null,'packages') as value",
        [operator],
      );
      assert.deepEqual(
        packages.events.map((e) => e.action),
        ["plan_pro"],
      );
      await assert.rejects(
        db.query("select public.lothuus_operator_usage($1)", [owner]),
        /OPERATOR_FORBIDDEN/,
      );
      await assert.rejects(
        db.query("select public.lothuus_admin_usage($1,$2)", [
          owner,
          JSON.stringify([
            { ...usageEvent, id: randomUUID(), action: "PRIVATE_CONTENT" },
          ]),
        ]),
        /INVALID_USAGE/,
      );
      const arrival = {
        id: randomUUID(),
        action: "workspace_open",
        section: "overview",
      };
      for (let n = 0; n < 2; n++)
        await db.query("select public.lothuus_admin_usage($1,$2)", [
          owner,
          JSON.stringify([arrival]),
        ]);
      const arrivals = await one<{
        total: number;
        activity: { kind: string; actor: string }[];
      }>(
        "select public.lothuus_operator_activity_page($1,'','access','owner') as value",
        [operator],
      );
      assert.equal(arrivals.total, 1);
      assert.equal(arrivals.activity[0].kind, "workspace_open");
      assert.equal(arrivals.activity[0].actor, "Eigenaar");
      assert.equal(
        await one(
          "select count(*)::int as value from app_private.operator_activity where kind='owner_login'",
        ),
        0,
      );
      const afterArrival = await one<Usage>(
        "select public.lothuus_operator_usage($1) as value",
        [operator],
      );
      assert.equal(afterArrival.totals.actions, 1);
      assert.equal(afterArrival.events[0].action, "workspace_open");
      for (const action of Object.keys(usageActions))
        await db.query("select public.lothuus_admin_usage($1,$2)", [
          owner,
          JSON.stringify([{ id: randomUUID(), action, section: "hosting" }]),
        ]);
      // Manual grants preserve data, do not create payments, and tolerate an uncertain retry.
      const accountStamp = () =>
        one<string>(
          "select updated_at::text as value from app_private.hosting_account where id",
        );
      const stamp = await accountStamp(),
        grant = randomUUID(),
        expiry = new Date(Date.now() + 86400000 * 30).toISOString();
      const grantPackage = (
        id: string,
        plan: string,
        until: string | null,
        expected: string,
        provisioned = true,
      ) =>
        db.query(
          "select public.lothuus_operator_grant_package($1,$2,$3,$4,$5,$6,$7)",
          [operator, id, plan, until, expected, "Testafspraak", provisioned],
        );
      const ordersBefore = await one<number>(
        "select count(*)::int as value from app_private.hosting_orders",
      );
      await assert.rejects(
        grantPackage(randomUUID(), "pro", expiry, stamp, false),
        /INVALID_OPERATOR_INPUT/,
      );
      await grantPackage(grant, "pro", expiry, stamp);
      await grantPackage(grant, "pro", expiry, stamp);
      assert.equal(
        await one(
          "select count(*)::int as value from app_private.operator_package_grants",
        ),
        1,
      );
      assert.equal(
        await one(
          "select count(*)::int as value from app_private.hosting_orders",
        ),
        ordersBefore,
      );
      assert.equal((await policy()).count, 202);
      assert.equal((await policy()).limit, 1050);
      await assert.rejects(
        grantPackage(randomUUID(), "premium", expiry, stamp),
        /OPERATOR_VERSION_CONFLICT/,
      );
      await grantPackage(randomUUID(), "basis", null, await accountStamp());
      assert.equal((await policy()).count, 202);
      assert.equal((await policy()).limit, 250);
      // Real inventory projections, baseline versions, work notes and manual jobs.
      type Inventory = {
        total: number;
        items: {
          id: string;
          title: string;
          missing: string[];
          stock: string;
        }[];
        counts: Record<string, number>;
      };
      const inventory = await one<Inventory>(
        "select public.lothuus_operator_inventory($1) as value",
        [operator],
      );
      assert.ok(inventory.items.every((i) => i.stock === "available"));
      state.reservations = [
        {
          id: randomUUID(),
          itemId: state.items[0].id,
          status: "active",
          priceCents: 1250,
          payments: [],
        },
        {
          id: randomUUID(),
          itemId: state.items[1].id,
          status: "completed",
          priceCents: 1000,
          payments: [],
        },
      ] as unknown as typeof state.reservations;
      await commit();
      const reserved = await one<Inventory>(
        "select public.lothuus_operator_inventory($1,'','reserved') as value",
        [operator],
      );
      assert.equal(reserved.total, 1);
      assert.equal(reserved.items[0].id, state.items[0].id);
      const sold = await one<Inventory>(
        "select public.lothuus_operator_inventory($1,'','sold') as value",
        [operator],
      );
      assert.equal(sold.total, 1);
      assert.equal(sold.items[0].id, state.items[1].id);
      state.reservations = [];
      await commit();
      assert.equal(inventory.total, 202);
      assert.equal(inventory.items.length, 40);
      assert.equal(inventory.counts.incomplete, 202);
      const searched = await one<Inventory>(
        "select public.lothuus_operator_inventory($1,'Gewijzigd','all',0,'title') as value",
        [operator],
      );
      assert.ok(searched.items.some((i) => i.id === state.items[0].id));
      const noMatch = await one<Inventory>(
        "select public.lothuus_operator_inventory($1,'%_','all') as value",
        [operator],
      );
      assert.equal(noMatch.total, 0);
      const product = await one<{
        item: { id: string };
        versions: { id: string }[];
      }>("select public.lothuus_operator_product($1,$2) as value", [
        operator,
        state.items[0].id,
      ]);
      assert.equal(product.item.id, state.items[0].id);
      assert.ok(product.versions.length >= 2);
      const past = await one<{ id: string }>(
        "select public.lothuus_operator_version($1,$2,$3) as value",
        [operator, state.items[0].id, product.versions.at(-1)!.id],
      );
      assert.equal(past.id, state.items[0].id);
      const versionCount = await one<number>(
        "select count(*)::int as value from app_private.operator_versions",
      );
      await commit();
      assert.equal(
        await one(
          "select count(*)::int as value from app_private.operator_versions",
        ),
        versionCount,
      );
      const note = randomUUID();
      await db.query(
        "select public.lothuus_operator_note($1,$2,0,$3,$4,$5,$6,$7,null)",
        [
          operator,
          note,
          "Interne opvolging",
          "PRIVATE_NOTE",
          "open",
          "high",
          state.items[0].id,
        ],
      );
      await assert.rejects(
        db.query(
          "select public.lothuus_operator_note($1,$2,0,$3,$4,$5,$6,$7,null)",
          [
            operator,
            note,
            "Oude versie",
            "Tekst",
            "done",
            "normal",
            state.items[0].id,
          ],
        ),
        /OPERATOR_VERSION_CONFLICT/,
      );
      const work = await one<{ notes: { body: string }[] }>(
        "select public.lothuus_operator_work($1) as value",
        [operator],
      );
      assert.equal(work.notes[0].body, "PRIVATE_NOTE");
      const pulse = await one<{
        daily: unknown[];
        work: { open: number };
        collection: { all: number };
      }>("select public.lothuus_operator_pulse($1) as value", [operator]);
      assert.equal(pulse.daily.length, 30);
      assert.equal(pulse.work.open, 1);
      assert.equal(pulse.collection.all, 202);
      const events = await one<{ total: number; activity: { kind: string }[] }>(
        "select public.lothuus_operator_activity_page($1,'','product','owner',null,null,null,10) as value",
        [operator],
      );
      assert.equal(events.activity.length, 10);
      assert.ok(events.activity.every((e) => e.kind.startsWith("product_")));
      const exported = await one<{ total: number; items: unknown[] }>(
        "select public.lothuus_operator_export($1,$2) as value",
        [operator, "collection"],
      );
      assert.equal(exported.total, 202);
      assert.equal(exported.items.length, 202);
      const job = randomUUID();
      await db.query(
        "select public.lothuus_operator_job_start($1,$2,'backup')",
        [operator, job],
      );
      await assert.rejects(
        db.query(
          "select public.lothuus_operator_job_start($1,$2,'measurements')",
          [operator, randomUUID()],
        ),
        /OPERATOR_JOB_BUSY/,
      );
      await db.query(
        "select public.lothuus_operator_job_finish($1,'succeeded','Gecontroleerd')",
        [job],
      );
      const jobs = await one<{ status: string }[]>(
        "select public.lothuus_operator_jobs($1) as value",
        [operator],
      );
      assert.equal(jobs[0].status, "succeeded");
      const manual = randomUUID();
      assert.equal(
        await one(
          "select public.lothuus_maintenance_claim_manual($1,$2) as value",
          ["backup", manual],
        ),
        true,
      );
      assert.equal(
        await one(
          "select public.lothuus_maintenance_claim_manual($1,$2) as value",
          ["backup", randomUUID()],
        ),
        false,
      );
      for (const query of [
        "select public.lothuus_operator_inventory($1)",
        "select public.lothuus_operator_work($1)",
        "select public.lothuus_operator_jobs($1)",
        "select public.lothuus_operator_pulse($1)",
      ])
        await assert.rejects(db.query(query, [owner]), /OPERATOR_FORBIDDEN/);
      await db.exec("set role anon");
      for (const query of [
        "select public.lothuus_capacity_policy()",
        `select public.lothuus_operator_report('${operator}')`,
        "select * from app_private.operator_activity",
        `select public.lothuus_operator_inventory('${operator}')`,
        `select public.lothuus_operator_work('${operator}')`,
        "select * from app_private.operator_versions",
        "select * from app_private.operator_notes",
        "select * from app_private.operator_usage_events",
        `select public.lothuus_operator_usage('${operator}')`,
        `select public.lothuus_operator_package_state('${operator}')`,
      ])
        await assert.rejects(db.exec(query), /permission denied/);
      await db.exec("reset role;set role authenticated");
      await assert.rejects(
        db.query(
          "select public.lothuus_operator_policy($1,4,false,null,null,$2)",
          [operator, "Poging"],
        ),
        /permission denied/,
      );
      await db.exec("reset role");
      await db.query(
        "update app_private.operator_users set enabled=false where user_id=$1",
        [operator],
      );
      await db.query("select public.lothuus_operator_bootstrap($1)", [
        operator,
      ]);
      await assert.rejects(report(), /OPERATOR_FORBIDDEN/);
    } finally {
      await db.close();
    }
  },
);
