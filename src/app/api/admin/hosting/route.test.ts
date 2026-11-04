import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { authenticate } from '@/lib/backend/local-auth';

test('the capacity view requires an owner and returns only uncached capacity data', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lothuus-capacity-route-'));
  const previous = { BACKEND_MODE: process.env.BACKEND_MODE, LOTHUUS_DATA_DIR: process.env.LOTHUUS_DATA_DIR, ADMIN_PASSWORD: process.env.ADMIN_PASSWORD };
  process.env.BACKEND_MODE = 'local'; process.env.LOTHUUS_DATA_DIR = dir; process.env.ADMIN_PASSWORD = randomUUID();
  try {
    const url = 'http://localhost/api/admin/hosting?view=capacity';
    assert.equal((await GET(new NextRequest(url))).status, 401);
    const response = await GET(new NextRequest(url, { headers: { cookie: `lothuus-owner=${authenticate(process.env.ADMIN_PASSWORD)}` } }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await response.json(), { count: 0, limit: 200, enforced: true });
  } finally {
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    rmSync(dir, { recursive: true, force: true });
  }
});
