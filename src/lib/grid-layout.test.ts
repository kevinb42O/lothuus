import test from 'node:test';
import assert from 'node:assert/strict';
import { collectionLayout, captionHeight } from './grid-layout';

test('portrait, landscape and square enlargements preserve the actual photo ratio', () => {
  const ids = Array.from({ length: 195 }, (_, i) => String(i));
  for (const ratio of [.3, .75, 1, 4 / 3, 2.5]) for (const columns of [2, 3, 4, 6, 8]) {
    for (let i = 0; i < ids.length; i++) {
      const { cells, height } = collectionLayout(ids, columns, { id: ids[i], column: i % columns, row: Math.floor(i / columns), aspectRatio: ratio }, 140, 10);
      assert.deepEqual(cells.map(c => c.id), ids);
      const expanded = cells[i];
      assert.ok(Math.abs(expanded.width / (expanded.height - captionHeight) - ratio) < .00001);
      for (const tile of cells) {
        assert.ok(tile.x >= 0 && tile.x + tile.width <= columns * 150 - 10 + .001);
        assert.ok(tile.y >= 0 && tile.y + tile.height <= height + .001);
        if (tile === expanded) continue;
        const overlaps = Math.min(tile.x + tile.width, expanded.x + expanded.width) - Math.max(tile.x, expanded.x) > .001
          && Math.min(tile.y + tile.height, expanded.y + expanded.height) - Math.max(tile.y, expanded.y) > .001;
        assert.equal(overlaps, false, `Photo overlaps ${tile.id}`);
      }
      for (let column = 0; column < columns; column++) {
        const tiles = cells.filter(c => !c.expanded && c.column === column).sort((a, b) => a.y - b.y);
        for (let j = 1; j < tiles.length; j++) assert.ok(tiles[j].y >= tiles[j - 1].y + tiles[j - 1].height + 10 - .001);
      }
    }
  }
});

test('neighbors resume immediately below the actual caption, without rounding to a square footprint', () => {
  const ids = Array.from({ length: 40 }, (_, i) => String(i));
  const { cells } = collectionLayout(ids, 8, { id: '0', column: 0, row: 0, aspectRatio: 4 / 3 }, 140, 10);
  const expanded = cells[0];
  const underneath = cells.find(c => !c.expanded && c.column === expanded.column && c.y > expanded.y)!;
  assert.ok(Math.abs(underneath.y - expanded.y - expanded.height - 10) < .001);
});

test('empty collections, removed selections, invalid ratios and extreme anchors remain valid', () => {
  assert.deepEqual(collectionLayout([], 8, null), { cells: [], height: 0 });
  const ids = ['a', 'b', 'c'];
  assert.deepEqual(collectionLayout(ids, 4, { id: 'removed', column: 0, row: 0, aspectRatio: 1 }), collectionLayout(ids, 4, null));
  const { cells } = collectionLayout(ids, 4, { id: 'b', column: 99, row: 999, aspectRatio: NaN });
  assert.equal(cells[1].column, 1); assert.equal(cells[1].row, 0);
  assert.equal(cells[1].width, cells[1].height - captionHeight);
});
