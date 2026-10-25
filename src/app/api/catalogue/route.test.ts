import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { initialStore } from '../../../lib/backend/repository';

test('catalogue responses use the dedicated projection, hide private fields and support conditional requests', async () => {
  const previous = { mode: process.env.BACKEND_MODE, url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY, fetch: globalThis.fetch };
  process.env.BACKEND_MODE = 'supabase'; process.env.SUPABASE_URL = 'https://audit-supabase.example.test'; process.env.SUPABASE_SECRET_KEY = 'isolated-audit-key';
  let reads = 0;
  const state = initialStore(); state.notifications = [];
  state.customers.push({ id: 'private-customer', name: 'Private name', email: 'private@example.test', phone: '', channel: 'email', notes: 'Private notes', createdAt: '' });
  globalThis.fetch = async input => {
    const path = String(input);
    assert.ok(path.endsWith('/lothuus_catalogue_projection')); reads++;
    return Response.json(state);
  };
  try {
    const { GET } = await import('./route');
    const get = (tag?: string) => GET(new NextRequest('http://localhost:3000/api/catalogue', { headers: tag ? { 'If-None-Match': tag } : {} }));
    const first = await get(), tag = first.headers.get('etag')!;
    assert.ok(tag); assert.equal(reads, 1);
    assert.equal((await first.text()).includes('private@example.test'), false);
    assert.equal((await get(tag)).status, 304);
    assert.equal((await get()).status, 200);
    state.settings.businessName = 'Gewijzigde collectie';
    const changed = await get(tag); assert.equal(changed.status, 200); assert.notEqual(changed.headers.get('etag'), tag); assert.equal(reads, 4);
  } finally {
    globalThis.fetch = previous.fetch;
    for (const [key, value] of Object.entries({ BACKEND_MODE: previous.mode, SUPABASE_URL: previous.url, SUPABASE_SECRET_KEY: previous.key })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
