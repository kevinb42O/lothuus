import test from 'node:test';
import assert from 'node:assert/strict';
import { detailLayout } from './detail-layout';

test('detail photo frames preserve the complete image ratio on desktop and phones', () => {
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 820, height: 600 }, { width: 390, height: 844 }]) {
    for (const ratio of [.3, .75, 1, 4 / 3, 2.5]) for (const zoom of [false, true]) {
      const layout = detailLayout(ratio, viewport, zoom);
      assert.ok(Math.abs(layout.photoWidth / layout.photoHeight - ratio) < .00001);
      assert.ok(layout.width <= viewport.width - 24);
      assert.ok(layout.photoWidth <= layout.width);
      if (layout.mode !== 'stacked') assert.ok(layout.photoHeight <= viewport.height - 24);
      if (layout.mode === 'split') assert.ok(layout.width - layout.photoWidth >= 340);
    }
  }
});
test('portrait uses a separate text column; landscape and mobile place the text below', () => {
  assert.equal(detailLayout(.75, { width: 1280, height: 720 }).mode, 'split');
  assert.equal(detailLayout(4 / 3, { width: 1280, height: 720 }).mode, 'stacked');
  assert.equal(detailLayout(.75, { width: 390, height: 844 }).mode, 'stacked');
  assert.equal(detailLayout(.75, { width: 1280, height: 720 }, true).mode, 'photo');
});
