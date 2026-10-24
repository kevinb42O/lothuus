import assert from 'node:assert/strict';
import test from 'node:test';
import { PointerIntent, type IntentTarget } from './pointer-intent';

const targets: IntentTarget[] = ['A', 'B', 'C', 'D'].map((id, index) => ({ id, left: index * 110, right: index * 110 + 100, top: 0, bottom: 100 }));

test('a continuous crossing skips B and C and lands directly on D', () => {
  const intent = new PointerIntent();
  for (let index = 0; index <= 18; index++) {
    assert.equal(intent.move({ x: 20 + index * 20, y: 50, time: index * 16 }, () => targets), null);
    assert.equal(intent.finish(index * 16 + 15), null);
  }
  assert.equal(intent.finish(340), 'D');
  assert.equal(intent.finish(400), null, 'a landing only fires once');
});

test('slow continuous movement does not count as arrival', () => {
  const intent = new PointerIntent();
  for (let index = 0; index < 180; index++) {
    assert.equal(intent.move({ x: 20 + index * 2, y: 50, time: index * 16 }, () => targets), null);
    assert.equal(intent.finish(index * 16 + 15), null);
  }
  assert.equal(intent.finish(3000), 'D');
});

test('subpixel travel keeps a slow journey alive instead of opening crossed tiles', () => {
  const intent = new PointerIntent();
  for (let index = 0; index < 200; index++) {
    assert.equal(intent.move({ x: 120 + index * .25, y: 50, time: index * 16 }, () => targets), null);
    assert.equal(intent.finish(index * 16 + 15), null);
  }
  assert.equal(intent.finish(3300), 'B');
});

test('clear braking selects before the pointer has stopped', () => {
  const intent = new PointerIntent();
  const xs = [10, 40, 80, 120, 155, 168, 174, 176, 178];
  const selections = xs.map((x, index) => intent.move({ x, y: 50, time: index * 16 }, () => targets)).filter(Boolean);
  assert.deepEqual(selections, ['B']);
});

test('a projected endpoint outside the tile prevents premature braking selection', () => {
  const intent = new PointerIntent();
  const xs = [5, 35, 65, 80, 86, 90, 93];
  for (const [index, x] of xs.entries()) assert.equal(intent.move({ x, y: 50, time: index * 16 }, () => targets), null);
});

test('layout changes cannot replace the destination during a journey', () => {
  const intent = new PointerIntent();
  let reads = 0;
  let current = targets;
  const snapshot = () => { reads++; return current; };
  intent.move({ x: 20, y: 50, time: 0 }, snapshot);
  current = targets.map(target => ({ ...target, id: `moved-${target.id}` }));
  intent.move({ x: 165, y: 50, time: 16 }, snapshot);
  assert.equal(intent.finish(80), 'B');
  assert.equal(reads, 1);
  intent.move({ x: 280, y: 50, time: 100 }, snapshot);
  assert.equal(intent.finish(180), 'moved-C', 'a new journey takes fresh geometry');
});

test('single-event arrivals work; gaps and ambiguous borders remain neutral', () => {
  for (const [x, expected] of [[160, 'B'], [105, null], [110, null]] as const) {
    const intent = new PointerIntent();
    intent.move({ x, y: 50, time: 0 }, () => targets);
    assert.equal(intent.finish(60), expected);
  }
});

test('reset discards a journey and sensor jitter does not rearm a landed product', () => {
  const intent = new PointerIntent();
  intent.move({ x: 165, y: 50, time: 0 }, () => targets);
  assert.equal(intent.finish(60), 'B');
  intent.move({ x: 165.4, y: 50.2, time: 100 }, () => targets);
  assert.equal(intent.tracking, false);
  intent.move({ x: 169, y: 51, time: 110 }, () => targets);
  assert.equal(intent.tracking, false, 'a small landing correction cannot select a moving neighbor');
  intent.move({ x: 280, y: 50, time: 120 }, () => targets);
  intent.reset();
  assert.equal(intent.finish(300), null);
});

test('diagonal travel across a dense grid makes only the final selection', () => {
  const grid = Array.from({ length: 16 }, (_, index) => ({
    id: String(index), left: index % 4 * 110, right: index % 4 * 110 + 100,
    top: Math.floor(index / 4) * 110, bottom: Math.floor(index / 4) * 110 + 100,
  }));
  const intent = new PointerIntent();
  for (let index = 0; index <= 36; index++) {
    assert.equal(intent.move({ x: 20 + index * 10, y: 20 + index * 10, time: index * 16 }, () => grid), null);
    assert.equal(intent.finish(index * 16 + 15), null);
  }
  assert.equal(intent.finish(650), '15');
});

test('changing direction does not itself select the product at the turn', () => {
  const intent = new PointerIntent();
  const xs = [20, 60, 100, 140, 180, 220, 260, 220, 180, 140];
  for (const [index, x] of xs.entries()) {
    assert.equal(intent.move({ x, y: 50, time: index * 16 }, () => targets), null);
    assert.equal(intent.finish(index * 16 + 15), null);
  }
  assert.equal(intent.finish(220), 'B');
});

test('movement cadence adapts to a lower polling rate', () => {
  const intent = new PointerIntent();
  for (let index = 0; index < 9; index++) {
    intent.move({ x: 20 + index * 40, y: 50, time: index * 32 }, () => targets);
    assert.equal(intent.finish(index * 32 + 31), null);
  }
  assert.equal(intent.finish(360), 'D');
});
