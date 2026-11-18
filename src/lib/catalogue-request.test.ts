import test from 'node:test';
import assert from 'node:assert/strict';
import { requestCatalogue } from './catalogue-request';
import { settle } from '../test/dom';

test('catalogue retries interrupted JSON bodies and server failures while the page stays open', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  const data = { objects: [], hasInventory: false, settings: {} };
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    assert.equal(new Headers(init.headers).get('if-none-match'), '"previous"');
    calls++;
    if (calls === 1) return { ok: true, status: 200, json: async () => { throw new Error('Interrupted body'); } };
    if (calls === 2) return new Response(null, { status: 503 });
    return Response.json(data, { headers: { ETag: '"next"' } });
  });
  const result = requestCatalogue('"previous"');
  await settle();
  assert.equal(calls, 1);
  t.mock.timers.tick(3000); await settle();
  assert.equal(calls, 2);
  t.mock.timers.tick(10_000); await settle();
  assert.deepEqual(await result, { data, tag: '"next"' });
  assert.equal(calls, 3);
});

test('an unchanged catalogue keeps its tag without parsing an empty 304 body', async t => {
  const deadlines: number[] = [];
  t.mock.method(AbortSignal, 'timeout', (milliseconds: number) => {
    deadlines.push(milliseconds);
    return new AbortController().signal;
  });
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 304 }));
  assert.deepEqual(await requestCatalogue('"current"'), { data: null, tag: '"current"' });
  assert.deepEqual(deadlines, [120_000], 'slow connections get two minutes to download the body');
});

test('persistent failures stop after three attempts', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw new Error('Offline'); });
  const failed = assert.rejects(requestCatalogue(), /Offline/);
  await settle(); t.mock.timers.tick(3000);
  await settle(); t.mock.timers.tick(10_000);
  await failed;
  assert.equal(calls, 3);
});
