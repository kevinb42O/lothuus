import test from 'node:test';
import assert from 'node:assert/strict';
import { elasticProfile, elasticStep } from './elastic-scroll';

test('outer columns lag symmetrically and compact devices use less displacement', () => {
  for (const columns of [3, 4, 6, 8]) for (let column = 0; column < columns; column++) {
    assert.deepEqual(elasticProfile(column, columns), elasticProfile(columns - 1 - column, columns));
    assert.ok(elasticProfile(column, columns, true).limit < elasticProfile(column, columns).limit);
  }
  assert.ok(elasticProfile(0, 8).time > elasticProfile(3, 8).time);
});
test('large wheel jumps stay bounded and elastic motion returns to exact rest', () => {
  const profile = elasticProfile(0, 8);
  for (const delta of [-10000, 10000]) {
    let offset = elasticStep(0, delta, 1 / 60, profile.time, profile.limit);
    assert.ok(Math.abs(offset) <= profile.limit);
    assert.equal(Math.sign(offset), Math.sign(delta));
    let last = Math.abs(offset);
    for (let frame = 0; frame < 240; frame++) {
      offset = elasticStep(offset, 0, 1 / 60, profile.time, profile.limit);
      assert.ok(Math.abs(offset) <= last); last = Math.abs(offset);
    }
    assert.equal(offset, 0);
  }
});
test('decay is consistent at 60Hz and 120Hz', () => {
  let a = 80, b = 80;
  for (let i = 0; i < 30; i++) a = elasticStep(a, 0, 1 / 60, .28, 100);
  for (let i = 0; i < 60; i++) b = elasticStep(b, 0, 1 / 120, .28, 100);
  assert.ok(Math.abs(a - b) < .00001);
});
