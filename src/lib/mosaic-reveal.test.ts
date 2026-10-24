import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mosaicRevealDelta } from './mosaic-reveal';

test('an expansion near the bottom reveals its caption with the smallest scroll', () => {
  assert.equal(mosaicRevealDelta(450, 500, 92, 784), 166);
});
test('a fully visible expansion does not move the page', () => {
  assert.equal(mosaicRevealDelta(110, 500, 92, 784), 0);
});
test('keyboard expansion above the sticky navigation is brought below it', () => {
  assert.equal(mosaicRevealDelta(40, 500, 92, 784), -52);
});
test('a viewport shorter than the card prioritizes the caption without oscillating', () => {
  assert.equal(mosaicRevealDelta(150, 500, 92, 384), 266);
  assert.equal(mosaicRevealDelta(-116, 500, 92, 384), 0);
});
