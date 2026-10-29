import assert from 'node:assert/strict';
import test from 'node:test';
import { PointerIntent } from './pointer-intent';

test('an object opens only after two uninterrupted seconds and only once', () => {
  const intent = new PointerIntent();
  intent.move('A', 100);
  assert.equal(intent.finish(2099), null);
  assert.equal(intent.finish(2100), 'A');
  assert.equal(intent.finish(3000), null);
});

test('moving within one object preserves the original hover start', () => {
  const intent = new PointerIntent();
  intent.move('A', 0);
  for (const now of [16, 200, 900, 1999]) {
    assert.equal(intent.move('A', now), false);
    assert.equal(intent.finish(now), null);
  }
  assert.equal(intent.finish(2000), 'A');
});

test('switching objects restarts the full delay, including when returning', () => {
  const intent = new PointerIntent();
  intent.move('A', 0);
  intent.move('B', 1900);
  assert.equal(intent.finish(2000), null);
  intent.move('A', 2100);
  assert.equal(intent.finish(4099), null);
  assert.equal(intent.finish(4100), 'A');
});

test('leaving for a gap or resetting cancels a pending expansion', () => {
  const intent = new PointerIntent();
  intent.move('A', 0);
  intent.move(null, 1999);
  assert.equal(intent.finish(3000), null);
  intent.move('A', 4000);
  assert.equal(intent.finish(5999), null);
  intent.reset();
  assert.equal(intent.finish(6000), null);
  intent.move('A', 7000);
  assert.equal(intent.finish(8999), null);
  assert.equal(intent.finish(9000), 'A');
});
