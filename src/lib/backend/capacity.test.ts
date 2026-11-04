import test from 'node:test';
import assert from 'node:assert/strict';
import { initialStore } from './repository';
import { withStore } from './cloud';

// No network or production data: Supabase RPCs use an isolated fake transport.
test('a competing create fills the last slot and a revision retry refuses the second create', async () => {
  const originalFetch = globalThis.fetch;
  const previous = { mode: process.env.BACKEND_MODE, url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY };
  process.env.BACKEND_MODE = 'supabase'; process.env.SUPABASE_URL = 'https://capacity.example.test'; process.env.SUPABASE_SECRET_KEY = 'isolated-test-key';
  let reads = 0, commits = 0;
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.endsWith('/lothuus_load_state')) {
      const state = initialStore();
      state.notifications = [];
      state.items = Array.from({ length: reads++ === 0 ? 199 : 200 }, (_, n) => ({ id: String(n), title: 'Bestaand' })) as typeof state.items;
      return Response.json({ state, revision: reads });
    }
    if (url.endsWith('/lothuus_hosting_report')) return Response.json({ limit: 200 });
    if (url.endsWith('/lothuus_commit_state')) { commits++; return Response.json(false); }
    throw new Error(`Unexpected request: ${url}`);
  };
  try {
    await assert.rejects(withStore(state => { state.items.push({ ...state.items[0], id: 'nieuw' }); }), /Je pakketlimiet is bereikt/);
    assert.equal(reads, 2); assert.equal(commits, 1);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries({ BACKEND_MODE: previous.mode, SUPABASE_URL: previous.url, SUPABASE_SECRET_KEY: previous.key })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('existing products remain readable, editable and idempotently retryable without capacity or metrics services', async () => {
  const originalFetch = globalThis.fetch;
  const previous = { BACKEND_MODE: process.env.BACKEND_MODE, SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY };
  process.env.BACKEND_MODE = 'supabase'; process.env.SUPABASE_URL = 'https://capacity.example.test'; process.env.SUPABASE_SECRET_KEY = 'isolated-test-key';
  let commits = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith('/lothuus_load_state')) {
      const state = initialStore();
      state.notifications = [];
      state.items = Array.from({ length: 304 }, (_, n) => ({ id: String(n), title: 'Bestaand' })) as typeof state.items;
      return Response.json({ state, revision: 1 });
    }
    if (url.endsWith('/lothuus_commit_state')) {
      commits++;
      const { next_state } = JSON.parse(String(init?.body));
      assert.equal(next_state.items.length, 304);
      assert.equal(next_state.items[0].title, 'Gewijzigd');
      return Response.json(true);
    }
    throw new Error(`Existing product management must not query capacity: ${url}`);
  };
  try {
    assert.equal(await withStore(state => state.items.length), 304);
    // An already-applied create retry leaves the snapshot unchanged.
    await withStore(() => {});
    assert.equal(commits, 0);
    await withStore(state => { state.items[0].title = 'Gewijzigd'; });
    assert.equal(commits, 1);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
