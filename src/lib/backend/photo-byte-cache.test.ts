import test from 'node:test';
import assert from 'node:assert/strict';
import { PhotoByteCache } from './photo-byte-cache';

const bytes = (size: number) => new Uint8Array(size).fill(42);
test('warm and concurrent reads share one storage read; bodies remain reusable', async () => {
  const cache = new PhotoByteCache(); let reads = 0;
  const load = async () => { reads++; return bytes(3); };
  const results = await Promise.all(Array.from({ length: 20 }, () => cache.read('photo-grid', load)));
  assert.equal(reads, 1);
  for (const body of results) assert.equal(await new Response(body).text(), '***');
  assert.equal(await new Response(await cache.read('photo-grid', load)).text(), '***');
  assert.equal(reads, 1);
});
test('cache enforces a byte budget with LRU eviction, expiry, and oversized bypass', async () => {
  let now = 0; const cache = new PhotoByteCache(6, 100, () => now);
  const reads: string[] = [];
  const get = (key: string, size = 3) => cache.read(key, async () => { reads.push(key); return bytes(size); });
  await get('a'); await get('b'); await get('a'); await get('c'); await get('a');
  assert.deepEqual(reads, ['a', 'b', 'c']);
  await get('b'); assert.deepEqual(reads, ['a', 'b', 'c', 'b']);
  now = 101; await get('b'); assert.equal(reads.length, 5);
  await get('large', 7); await get('large', 7); assert.equal(reads.length, 7);
  await get('b'); assert.equal(reads.length, 7, 'oversized photos do not evict useful entries');
});
test('failed and missing objects are retried instead of cached', async () => {
  const cache = new PhotoByteCache(); let reads = 0;
  await assert.rejects(cache.read('a', async () => { reads++; throw new Error('storage unavailable'); }));
  assert.equal(await cache.read('a', async () => { reads++; return null; }), null);
  assert.deepEqual(await cache.read('a', async () => { reads++; return bytes(2); }), bytes(2));
  assert.equal(reads, 3);
});

test('many small variants cannot grow cache metadata without bound', async () => {
  const cache = new PhotoByteCache(1000, 100, () => 0, 2);
  let reads = 0;
  const get = (key: string) => cache.read(key, async () => { reads++; return bytes(1); });
  await get('a'); await get('b'); await get('c'); await get('b');
  assert.equal(reads, 3);
  await get('a'); assert.equal(reads, 4, 'entry limit evicts even before the byte budget is reached');
});
test('all concurrent waiters recover together after an upstream failure', async () => {
  const cache = new PhotoByteCache(); let reads = 0;
  const results = await Promise.allSettled(Array.from({ length: 20 }, () => cache.read('a', async () => { reads++; throw new Error('upstream'); })));
  assert.equal(reads, 1); assert.ok(results.every(result => result.status === 'rejected'));
  assert.deepEqual(await cache.read('a', async () => { reads++; return bytes(2); }), bytes(2));
  assert.equal(reads, 2);
});
