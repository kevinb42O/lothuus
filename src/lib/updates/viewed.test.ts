import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom } from '../../test/dom';
import { readViewed, saveViewed } from './viewed';

test('viewed updates recover from invalid data, deduplicate and bound browser storage', () => {
  const ui = setupDom();
  try {
    localStorage.setItem('lothuus-updates-viewed-v1', '{bad');
    assert.deepEqual(readViewed(), []);
    localStorage.setItem('lothuus-updates-viewed-v1', JSON.stringify([false, 'a', 'a', null, 'b']));
    assert.deepEqual(readViewed(), ['a', 'b']);
    assert.deepEqual(saveViewed(['b', 'c']), ['a', 'b', 'c']);
    assert.equal(saveViewed(Array.from({ length: 250 }, (_, index) => `id-${index}`)).length, 200);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
    assert.deepEqual(readViewed(), []);
    assert.deepEqual(saveViewed(['still-readable']), ['still-readable']);
  } finally { ui.cleanup(); }
});
