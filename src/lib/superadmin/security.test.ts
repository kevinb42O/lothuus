import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { operatorIdentity } from "./auth";
import { operatorCommand } from "./server";

test("only the named operator with server-owned metadata passes identity selection", () => {
  const id = randomUUID();
  assert.equal(operatorIdentity(null), null);
  assert.equal(
    operatorIdentity({
      id,
      email: "kevin@webaanzee.be",
      app_metadata: { role: "owner" },
    }),
    null,
  );
  assert.equal(
    operatorIdentity({
      id,
      email: "katrien@lothuus.be",
      app_metadata: { role: "superadmin" },
    }),
    null,
  );
  assert.equal(
    operatorIdentity({
      id,
      email: "kevin@webaanzee.be",
      app_metadata: { role: "superadmin" },
    }),
    id,
  );
});
test("operator commands reject unexpected fields, invalid quotas and unreviewable changes", () => {
  const policy = {
    action: "policy",
    version: 1,
    enforced: true,
    limit: null,
    expiresAt: null,
    reason: "Afspraak vastgelegd",
  };
  assert.equal(operatorCommand.safeParse(policy).success, true);
  for (const change of [
    { limit: 0 },
    { limit: 1.5 },
    { limit: 100001 },
    { version: 0 },
    { reason: "" },
    { actor: randomUUID() },
    { plan: "premium" },
  ])
    assert.equal(
      operatorCommand.safeParse({ ...policy, ...change }).success,
      false,
    );
  assert.equal(
    operatorCommand.safeParse({
      action: "activate",
      orderId: randomUUID(),
      receipt: "Bankreferentie",
      provisioned: true,
      cents: 1,
    }).success,
    false,
  );
});
test("operator mutations reject cross-origin requests before credentials or data are consulted", async () => {
  const manage = await import("../../app/api/superadmin/manage/route");
  const session = await import("../../app/api/superadmin/session/route");
  const usage = await import("../../app/api/admin/usage/route");
  const request = () =>
    new NextRequest("https://lothuus.test/api/superadmin/manage", {
      method: "POST",
      headers: { origin: "https://other.test" },
      body: "{}",
    });
  assert.equal((await manage.POST(request())).status, 403);
  assert.equal((await usage.POST(request())).status, 403);
  assert.equal((await session.POST(request())).status, 403);
  assert.equal((await session.DELETE(request())).status, 403);
});

test("extended backups retain compatibility with complete earlier v2 snapshots", async () => {
  const { validateBackup, backupTables } =
    await import("../maintenance/backup-format");
  const { initialStore } = await import("../backend/repository");
  const snapshot = {
    schemaVersion: 2,
    createdAt: new Date().toISOString(),
    tables: Object.fromEntries(
      backupTables.map((name) => [name, [] as unknown[]]),
    ),
  };
  snapshot.tables.operator_settings = [{ id: true, enforce_limit: true }];
  snapshot.tables.store = [{ id: true, body: initialStore() }];
  snapshot.tables.hosting_account = [{ id: true }];
  snapshot.tables.heart_settings = [{ id: true }];
  snapshot.tables.analytics_config = [{ id: true }];
  assert.equal(Object.keys(validateBackup(snapshot).tables).length, 24);
  const intermediate = structuredClone(snapshot);
  for (const name of [
    "operator_usage_events",
    "operator_usage_daily",
    "operator_package_grants",
  ])
    delete intermediate.tables[name];
  assert.equal(Object.keys(validateBackup(intermediate).tables).length, 21);
  const previous = structuredClone(intermediate);
  for (const name of ["operator_notes", "operator_versions", "operator_jobs"])
    delete previous.tables[name];
  assert.equal(Object.keys(validateBackup(previous).tables).length, 18);
  const legacy = structuredClone(intermediate);
  for (const name of [
    "operator_users",
    "operator_settings",
    "operator_activity",
    "operator_notes",
    "operator_versions",
    "operator_jobs",
  ])
    delete legacy.tables[name];
  assert.equal(Object.keys(validateBackup(legacy).tables).length, 15);
  delete snapshot.tables.operator_activity;
  assert.throws(() => validateBackup(snapshot), /Incomplete backup/);
});
