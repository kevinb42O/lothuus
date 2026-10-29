import test from 'node:test';
import assert from 'node:assert/strict';
import { detailLayout } from './detail-layout';

test('detail frames fit the viewport and reserve a readable desktop text column', () => {
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 820, height: 600 }, { width: 701, height: 480 }, { width: 700, height: 600 }, { width: 390, height: 844 }]) {
    for (const ratio of [.3, .75, 1, 4 / 3, 2.5]) for (const zoom of [false, true]) {
      const layout = detailLayout(ratio, viewport, zoom);
      assert.ok(layout.width <= viewport.width - 24);
      assert.ok(layout.photoWidth <= layout.width);
      if (layout.mode !== 'stacked') assert.ok(layout.photoHeight <= viewport.height - 24);
      if (layout.mode === 'split') {
        assert.ok(layout.width - layout.photoWidth >= 340);
        // Contain fits the complete photo within a stable frame, without distortion or crop.
        const scale = Math.min(layout.photoWidth / ratio, layout.photoHeight);
        assert.ok(scale * ratio <= layout.photoWidth + .00001);
        assert.ok(scale <= layout.photoHeight + .00001);
      } else assert.ok(Math.abs(layout.photoWidth / layout.photoHeight - ratio) < .00001);
    }
  }
});
test('switching between portrait and landscape preserves both desktop columns and frame geometry', () => {
  const viewport = { width: 1280, height: 720 };
  const portrait = detailLayout(.75, viewport);
  for (const ratio of [.3, 1, 4 / 3, 2.5]) assert.deepEqual(detailLayout(ratio, viewport), portrait);
  assert.equal(portrait.mode, 'split');
  assert.equal(detailLayout(.75, { width: 390, height: 844 }).mode, 'stacked');
  assert.equal(detailLayout(4 / 3, { width: 390, height: 844 }).mode, 'stacked');
  assert.equal(detailLayout(.75, viewport, true).mode, 'photo');
});
