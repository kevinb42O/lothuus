import test from 'node:test';
import assert from 'node:assert/strict';
import { edgeRubberband, edgeSpringStep, elasticProfile, elasticStep } from './elastic-scroll';

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

test('edge resistance grows progressively and remains bounded under repeated pulls', () => {
  assert.equal(edgeRubberband(0, 180), 0);
  assert.equal(edgeRubberband(-40, 180), 0);
  assert.ok(edgeRubberband(200, 180) - edgeRubberband(100, 180) < edgeRubberband(100, 180));
  assert.ok(edgeRubberband(100000, 180) < 180);
});

test('edge return starts immediately, never bounces, and settles at both refresh rates', () => {
  const run = (hz: number, velocity: number) => {
    let state = { position: 90, velocity };
    for (let frame = 0; frame < Math.ceil(hz * .4); frame++) {
      const previous = state.position;
      state = edgeSpringStep(state.position, state.velocity, 1 / hz);
      assert.ok(state.position >= 0 && state.position <= previous);
      assert.ok(state.velocity <= 0);
      if (frame === 0) assert.ok(state.position < previous);
    }
    assert.deepEqual(state, { position: 0, velocity: 0 });
  };
  for (const hz of [60, 120]) for (const velocity of [0, -300, -10000, 300]) run(hz, velocity);
  const a = edgeSpringStep(90, -300, 1 / 60);
  const half = edgeSpringStep(90, -300, 1 / 120);
  const b = edgeSpringStep(half.position, half.velocity, 1 / 120);
  assert.ok(Math.abs(a.position - b.position) < .00001);
  assert.ok(Math.abs(a.velocity - b.velocity) < .00001);
  assert.ok(a.position < edgeSpringStep(90, 0, 1 / 60).position);
});
