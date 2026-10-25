import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { recordHearts } from './server';

test('an empty heart heartbeat refreshes activity without downloading the store', async () => {
  const previous = { mode: process.env.BACKEND_MODE, url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY, fetch: globalThis.fetch };
  process.env.BACKEND_MODE = 'supabase'; process.env.SUPABASE_URL = 'https://audit-supabase.example.test'; process.env.SUPABASE_SECRET_KEY = 'isolated-audit-key';
  const calls: string[] = [];
  globalThis.fetch = async input => {
    const name = String(input).split('/').at(-1)!; calls.push(name);
    assert.ok(['lothuus_heart_config', 'lothuus_heart_write'].includes(name));
    return Response.json(name === 'lothuus_heart_config' ? { enabled: true, startedAt: new Date().toISOString() } : null);
  };
  try {
    assert.deepEqual(await recordHearts({ operation: 'sync', browser: randomUUID(), actions: [] }), { enabled: true });
    assert.deepEqual(calls, ['lothuus_heart_config', 'lothuus_heart_write']);
  } finally {
    globalThis.fetch = previous.fetch;
    for (const [key, value] of Object.entries({ BACKEND_MODE: previous.mode, SUPABASE_URL: previous.url, SUPABASE_SECRET_KEY: previous.key })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
