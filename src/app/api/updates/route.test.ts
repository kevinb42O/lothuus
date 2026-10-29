import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { authenticate } from '../../../lib/backend/local-auth';
import { GET } from './route';

test('updates are private, require an owner session and return only curated fields', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lothuus-updates-'));
  const keys = ['BACKEND_MODE', 'LOTHUUS_DATA_DIR', 'ADMIN_PASSWORD'] as const;
  const previous = keys.map(key => process.env[key]);
  Object.assign(process.env, { BACKEND_MODE: 'local', LOTHUUS_DATA_DIR: directory, ADMIN_PASSWORD: 'isolated-updates-password' });
  try {
    const denied = await GET(new NextRequest('http://localhost/api/updates'));
    assert.equal(denied.status, 401);
    assert.equal(denied.headers.get('cache-control'), 'private, no-store');
    assert.equal('updates' in await denied.json(), false);
    const response = await GET(new NextRequest('http://localhost/api/updates', { headers: { cookie: `lothuus-owner=${authenticate('isolated-updates-password')}` } }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const { updates } = await response.json();
    assert.equal(updates.length, 19);
    assert.equal(new Set(updates.map((update: { id: string }) => update.id)).size, 19);
    assert.equal(updates.filter((update: { date: string }) => update.date < '2026-10-27').length, 12);
    assert.deepEqual(updates.map((update: { date: string }) => update.date), updates.map((update: { date: string }) => update.date).sort().reverse());
    for (const update of updates) {
      assert.deepEqual(Object.keys(update).sort(), (update.action ? ['id', 'date', 'title', 'body', 'action'] : ['id', 'date', 'title', 'body']).sort());
      if (update.action) assert(['items', 'visitors', 'hearts'].includes(update.action.target));
    }
    assert.doesNotMatch(JSON.stringify(updates), /quot|hosting|pakket|github|commit|supabase|r2|vercel/i);
  } finally {
    keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; });
    await rm(directory, { recursive: true, force: true });
  }
});
