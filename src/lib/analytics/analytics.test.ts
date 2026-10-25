import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { localDay, midnight, periodStart } from './time';
import { buildReport } from './report';
import { deviceType } from './device';
import { sessionForActivity, SESSION_GAP } from './session';
import type { AnalyticsRaw } from './types';

test('Brussels day, exact seven days, clamped months and daylight saving boundaries', () => {
  assert.equal(localDay('2026-10-24T22:30:00Z'), '2026-10-25');
  assert.equal((midnight('2026-10-26') - midnight('2026-10-25')) / 3600000, 25);
  assert.equal((midnight('2026-03-30') - midnight('2026-03-29')) / 3600000, 23);
  assert.equal(localDay(periodStart('7d', Date.parse('2026-10-25T12:00Z'), '2020-01-01')), '2026-10-19');
  assert.equal(localDay(periodStart('3m', Date.parse('2026-05-31T12:00Z'), '2020-01-01')), '2026-02-28');
});
test('the 24-hour window excludes its end, includes its start, and agrees with devices', () => {
  const to = Date.parse('2026-10-25T14:37:00Z'), from = to - 86400000;
  const raw: AnalyticsRaw = { enabled: true, now: new Date(to).toISOString(), startedAt: '2026-01-01T00:00Z', days: [], events: [
    { id: 'a', at: new Date(from - 1).toISOString(), device: 'desktop' },
    { id: 'b', at: new Date(from).toISOString(), device: 'mobile' },
    { id: 'c', at: new Date(to - 1).toISOString(), device: 'desktop' },
    { id: 'd', at: new Date(to).toISOString(), device: 'tablet' },
  ] };
  const report = buildReport(raw, '24h');
  assert.equal(report.points.length, 24); assert.equal(report.total, 2);
  assert.equal(report.points[0].visits, 1); assert.equal(report.points.at(-1)?.visits, 1);
  assert.equal(report.devices.reduce((n, d) => n + d.visits, 0), report.points.reduce((n, d) => n + d.visits, 0));
});
test('day reports zero fill within measurement start and preserve a paginated snapshot cutoff', () => {
  const raw: AnalyticsRaw = { enabled: true, now: '2026-10-25T15:00:00Z', startedAt: '2026-10-22T14:00:00Z', days: [
    { day: '2026-10-24', device: 'mobile', visits: 3 }, { day: '2026-10-25', device: 'desktop', visits: 2 },
  ], events: [{ id: 'later', at: '2026-10-25T14:45:00Z', device: 'desktop' }] };
  const report = buildReport(raw, '7d', Date.parse('2026-10-25T14:30Z'));
  assert.equal(report.points.length, 4); assert.equal(report.total, 4);
  assert.deepEqual(report.points.map(p => p.visits), [0, 0, 3, 1]);
  const year = buildReport({ ...raw, startedAt: '2026-01-01T00:00Z' }, 'year');
  assert.equal(year.points.length, 10); assert.equal(year.details.length, 50); assert.ok(year.pages > 1);
  assert.equal(year.points.reduce((n, p) => n + p.visits, 0), year.total);
});
test('database-aggregated event groups retain their counts, including a partial first hour', () => {
  const raw: AnalyticsRaw = { enabled: true, now: '2026-10-25T14:37:00Z', startedAt: '2026-10-25T14:00:00Z', days: [], events: [
    { at: '2026-10-25T14:05:00Z', device: 'desktop', visits: 6 },
    { at: '2026-10-25T14:12:00Z', device: 'mobile', visits: 2 },
  ] };
  const report = buildReport(raw, '24h');
  assert.equal(report.points.length, 1); assert.equal(report.total, 8); assert.equal(report.points[0].visits, 8);
  assert.equal(report.points[0].at, '2026-10-25T14:00:00.000Z');
});
test('activity, rerender and inactivity share a document session without storage', () => {
  let ids = 0; const uuid = () => String(++ids);
  const first = sessionForActivity(undefined, 100, uuid);
  first.sent = true;
  assert.equal(sessionForActivity(first, 200, uuid), first);
  assert.equal(sessionForActivity(first, 200 + SESSION_GAP - 1, uuid), first);
  const second = sessionForActivity(first, first.lastActivity + SESSION_GAP, uuid);
  assert.notEqual(first.id, second.id); assert.equal(second.sent, false); assert.equal(ids, 2);
});
test('device classification handles tablets and does not force unknown agents into desktop', () => {
  assert.equal(deviceType('Mozilla/5.0 (iPhone) Mobile'), 'mobile');
  assert.equal(deviceType('Mozilla/5.0 (Linux; Android 13) AppleWebKit'), 'tablet');
  assert.equal(deviceType('Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari'), 'desktop');
  assert.equal(deviceType(''), 'unknown');
});
test('persistent local writes deduplicate events, keep day totals and reject unauthenticated reports', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'lothuus-analytics-test-'));
  const previous = { data: process.env.LOTHUUS_DATA_DIR, mode: process.env.BACKEND_MODE };
  process.env.LOTHUUS_DATA_DIR = directory; process.env.BACKEND_MODE = 'local';
  try {
    const { localVisit, localRaw } = await import('./local');
    localVisit('one', 'mobile'); localVisit('one', 'mobile'); localVisit('two', 'desktop');
    const raw = localRaw(); assert.equal(raw.events.length, 2); assert.equal(raw.days.reduce((n, d) => n + d.visits, 0), 2);
    assert.ok(Date.parse(raw.events[0].at) >= Date.parse(raw.startedAt), 'The first accepted visit must not precede measurement start.');
    const { NextRequest } = await import('next/server');
    const { GET } = await import('../../app/api/admin/analytics/route');
    const response = await GET(new NextRequest('http://localhost:3000/api/admin/analytics'));
    assert.equal(response.status, 401); assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const { POST } = await import('../../app/api/analytics/visit/route');
    const request = (body: object, origin = 'http://localhost:3000') => new NextRequest('http://localhost:3000/api/analytics/visit', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await POST(request({ id: crypto.randomUUID(), route: '/admin' }))).status, 400);
    assert.equal((await POST(request({ id: crypto.randomUUID(), route: '/' }, 'https://foreign.test'))).status, 403);
    assert.equal((await POST(request({ id: crypto.randomUUID(), route: '/', extra: 'no' }))).status, 400);
    const valid = await POST(request({ id: crypto.randomUUID(), route: '/' })); assert.equal(valid.status, 204); assert.equal(valid.headers.get('set-cookie'), null);
  } finally {
    if (previous.data === undefined) delete process.env.LOTHUUS_DATA_DIR; else process.env.LOTHUUS_DATA_DIR = previous.data;
    if (previous.mode === undefined) delete process.env.BACKEND_MODE; else process.env.BACKEND_MODE = previous.mode;
    rmSync(directory, { recursive: true, force: true });
  }
});
