import assert from 'node:assert/strict';
import test from 'node:test';
import { photoWindowPolicy, selectPhotoWindow, type PhotoBounds } from './mosaic-photo-window';
import { mosaicPhotoSource, settlePhotoPreparation } from './mosaic-photo-source';

const tile = (id: string, top: number, pixels = 100000): PhotoBounds => ({ id, top, bottom: top + 150, pixels });
const policy = photoWindowPolicy(800, true);

test('prepares a viewport ahead, retains visited photos further out, and releases distant ones', () => {
  const bounds = [tile('visible', 100), tile('ahead', 1400), tile('visited', -1300), tile('unvisited', -1300), tile('distant', -2000)];
  const result = selectPhotoWindow(bounds, new Set(['visited', 'distant']), 800, policy);
  assert.deepEqual(result, new Set(['visible', 'ahead', 'visited']));
  // Reversing a little across the entry boundary does not unmount a loaded row.
  assert.ok(selectPhotoWindow([tile('ahead', 1700)], result, 800, policy).has('ahead'));
  assert.ok(!selectPhotoWindow([tile('ahead', 2500)], result, 800, policy).has('ahead'));
});

test('decoded pixel and count budgets evict farthest photos before visible or focused photos', () => {
  const bounds = [tile('far', 1500, 6), tile('near', 900, 6), tile('visible', 0, 6), { ...tile('focused', 5000, 6), pinned: true }];
  assert.deepEqual(selectPhotoWindow(bounds, new Set(), 800, { ...policy, pixels: 18, count: 3 }), new Set(['visible', 'focused', 'near']));
  const visible = Array.from({ length: 20 }, (_, n) => tile(String(n), 0, 1000000));
  assert.equal(selectPhotoWindow(visible, new Set(), 800, { ...policy, pixels: 1, count: 1 }).size, 20);
});

test('repeated complete scroll journeys keep the retained collection bounded', () => {
  let mounted: ReadonlySet<string> = new Set();
  for (let round = 0; round < 10; round++) {
    for (const offset of [0, 1500, 3000, 6000, 9000, 6000, 3000, 1500, 0]) {
      const bounds = Array.from({ length: 300 }, (_, n) => tile(String(n), Math.floor(n / 3) * 160 - offset));
      mounted = selectPhotoWindow(bounds, mounted, 800, policy);
      assert.ok(mounted.size <= policy.count);
    }
  }
  assert.ok(!mounted.has('299'));
});

test('data saving reduces speculative loading and source choice respects pixel density', () => {
  assert.equal(photoWindowPolicy(800, true, true).load, 400);
  for (const route of ['images', 'collection-images']) {
    const source = `/api/${route}/photo?size=grid&v=2`;
    assert.equal(mosaicPhotoSource(source, 150, 2).src, `/api/${route}/photo?size=thumb&v=2`);
    assert.equal(mosaicPhotoSource(source, 170, 2).src, source);
    assert.equal(mosaicPhotoSource(source, 150, 3).sourceWidth, 320);
    assert.equal(mosaicPhotoSource(source, 450, 2).sourceWidth, 800);
  }
  assert.equal(mosaicPhotoSource('/collection/G001/G001-01.webp', 150, 2).src, '/collection/G001/G001-01.webp');
});

test('preparation releases stalled and failed filters and clears the successful deadline', async () => {
  await settlePhotoPreparation([new Promise(() => {})], 10);
  await settlePhotoPreparation([Promise.reject(new Error('missing'))], 10000);
  await settlePhotoPreparation([Promise.resolve()], 10000);
});
