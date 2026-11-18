import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom } from '../test/dom';
import { retryPhotoViaServer } from './photo-fallback';

test('failed direct photos retry through the authorized server once and preserve the variant', () => {
  const ui = setupDom();
  try {
    const image = document.createElement('img');
    image.src = '/api/collection-images/photo?size=thumb';
    retryPhotoViaServer(image);
    const fallback = image.src;
    assert.equal(new URL(fallback).searchParams.get('delivery'), 'proxy');
    assert.equal(new URL(fallback).searchParams.get('size'), 'thumb');
    retryPhotoViaServer(image); assert.equal(image.src, fallback);
    for (const src of ['/house/photo.webp','https://other.example.test/api/images/id']) {
      image.src=src; const before=image.src; retryPhotoViaServer(image); assert.equal(image.src,before);
    }
  } finally { ui.cleanup(); }
});
