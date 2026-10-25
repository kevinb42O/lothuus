import test from 'node:test';
import assert from 'node:assert/strict';
import { objects } from './collection';
import { reconcileSelection, removeOrderedSelection } from './selection';

test('publishing an imported object preserves its saved selection and removes aliases only once', () => {
  const published = { ...objects[0], id: 'inventory-id', sourceReference: objects[0].id };
  assert.deepEqual(reconcileSelection([objects[0].id, 'inventory-id', 'retired-object'], [published]), ['inventory-id', 'retired-object']);
  assert.deepEqual(reconcileSelection(['inventory-id'], [published]), ['inventory-id']);
  assert.deepEqual(removeOrderedSelection(['inventory-id', 'another-object'], [objects[0].id], [published]), ['another-object']);
});
