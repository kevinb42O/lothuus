import test from 'node:test';
import assert from 'node:assert/strict';
import { collectionLayout } from './grid-layout';
import { categoryDirection, collectionColumns, filterTransition } from './filter-transition';

test('all category pairs reveal in navigation order; overview changes keep their shared-object choreography', () => {
  const order = ['alles', 'keramiek', 'glas', 'hout-riet-bamboe'];
  for (let from = 1; from < order.length; from++) for (let to = 1; to < order.length; to++) {
    assert.equal(categoryDirection(order[from], order[to], order), Math.sign(to - from));
  }
  for (const category of order) {
    assert.equal(categoryDirection('alles', category, order), 0);
    assert.equal(categoryDirection(category, 'alles', order), 0);
  }
});

test('a category gives photographs more room across phone, tablet and desktop', () => {
  for (const width of [280, 390, 600, 768, 900, 1200, 1584]) {
    const overview = collectionColumns(width, false);
    const focused = collectionColumns(width, true);
    assert.ok(focused < overview);
    assert.ok(focused >= 2);
  }
});

test('only photographs visible in both compositions keep their motion identity', () => {
  const cells = collectionLayout(['shared', 'from-below', 'new', 'leaves-viewport'], 2, null, 200, 10).cells;
  const plan = filterTransition(cells, new Map([
    ['shared', { top: 100, bottom: 240, left: 0, right: 140, key: 'shared:0' }],
    ['from-below', { top: 4000, bottom: 4140, left: 0, right: 140, key: 'from-below:0' }],
    ['leaves-viewport', { top: 10, bottom: 150, left: 0, right: 140, key: 'leaves-viewport:0' }],
  ]), 100, 300, 2);
  assert.equal(plan.keys.shared, 'shared:0');
  assert.equal(plan.keys['from-below'], 'from-below:2');
  assert.equal(plan.keys['leaves-viewport'], 'leaves-viewport:2');
  assert.deepEqual([...plan.arriving], ['from-below']);
});

test('rapid reversals keep the latest surviving identity; empty collections remain valid', () => {
  const cells = collectionLayout(['a'], 2, null, 160, 10).cells;
  const plan = filterTransition(cells, new Map([
    ['a', { top: 140, bottom: 300, left: 0, right: 160, key: 'a:7' }],
  ]), 100, 800, 9);
  assert.equal(plan.keys.a, 'a:7');
  assert.equal(plan.arriving.size, 0);
  assert.deepEqual(filterTransition([], new Map(), 100, 800, 10), { keys: {}, arriving: new Set() });
});
