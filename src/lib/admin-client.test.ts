import test from 'node:test';
import assert from 'node:assert/strict';
import { adminApi, invalidateStoreCache } from './admin-client';

test('an old background read cannot overwrite the saved admin snapshot or its ETag', async () => {
  const original = globalThis.fetch;
  let finishOld!: (response: Response) => void;
  let calls = 0;
  const first = { settingsVersion: 1 }, saved = { settingsVersion: 2 };
  invalidateStoreCache();
  globalThis.fetch = async (_url, options) => {
    calls++;
    if (calls === 1) return Response.json(first, { headers: { etag: '"1"' } });
    if (calls === 2) return new Promise(resolve => { finishOld = resolve; });
    if (calls === 3) return Response.json(saved, { headers: { etag: '"2"' } });
    assert.equal((options?.headers as Record<string, string>)['If-None-Match'], '"2"');
    return new Response(null, { status: 304 });
  };
  try {
    await adminApi('/api/store');
    const old = adminApi('/api/store');
    await adminApi('/api/store', { action: 'save-settings' });
    finishOld(Response.json(first, { headers: { etag: '"1"' } })); await old;
    assert.deepEqual(await adminApi('/api/store'), saved);
  } finally { globalThis.fetch = original; invalidateStoreCache(); }
});
