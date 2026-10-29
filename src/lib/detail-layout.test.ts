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
      if (layout.mode === 'split') assert.ok(layout.width - layout.photoWidth >= 340);
      if (layout.mode !== 'split') assert.ok(Math.abs(layout.photoWidth / layout.photoHeight - ratio) < .00001);
    }
  }
});
test('desktop uses the available width for every orientation and contains photos within the available height', () => {
  const viewport = { width: 1280, height: 720 };
  const portrait = detailLayout(.75, viewport);
  for (const ratio of [.3, 1, 4 / 3, 2.5]) {
    const layout = detailLayout(ratio, viewport, false, 192);
    assert.equal(layout.mode, 'split');
    assert.ok(layout.width >= viewport.width * .94);
    const inset = Math.max(16, Math.min(24, viewport.height * .025));
    assert.ok(layout.photoHeight + 192 <= viewport.height - inset * 2 + .00001);
    const imageHeight = Math.min(layout.photoWidth / ratio, layout.photoHeight);
    assert.ok(imageHeight * ratio <= layout.photoWidth + .00001);
  }
  assert.equal(portrait.mode, 'split');
  assert.equal(detailLayout(.75, { width: 390, height: 844 }).mode, 'stacked');
  assert.equal(detailLayout(4 / 3, { width: 390, height: 844 }).mode, 'stacked');
  assert.equal(detailLayout(.75, viewport, true).mode, 'photo');
});

test('large screens are no longer capped at a small fixed modal width', () => {
  for (const width of [1440, 1920, 2560, 3440]) {
    const layout = detailLayout(.75, { width, height: 1440 }, false, 192);
    assert.ok(layout.width >= width * .94);
    assert.ok(layout.width - layout.photoWidth <= 640);
  }
});
