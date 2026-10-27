import assert from 'node:assert/strict';
import test from 'node:test';
import { act } from 'react';
import { setupDom, settle } from '../test/dom';
import { objects } from '../lib/collection';
import { MosaicPhoto } from './mosaic-photo';

test('a larger source replaces a thumbnail only after decode; a superseded decode never commits', async () => {
  const ui = setupDom();
  const pending: (() => void)[] = [];
  ui.dom.window.Image = class {
    src = ''; sizes = ''; srcset = '';
    decode() { return new Promise<void>(resolve => pending.push(resolve)); }
  } as unknown as typeof Image;
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(ui.container);
  const object = { ...objects[0], image: '/api/images/photo?size=grid' };
  const src = () => ui.container.querySelector('img')?.getAttribute('src');
  try {
    await act(async () => root.render(<MosaicPhoto object={object} width={150} />));
    assert.equal(src(), '/api/images/photo?size=thumb');
    await act(async () => root.render(<MosaicPhoto object={object} width={400} />));
    assert.equal(src(), '/api/images/photo?size=thumb');
    await act(async () => root.render(<MosaicPhoto object={object} width={150} />));
    await act(async () => { pending.shift()!(); await settle(); });
    assert.equal(src(), '/api/images/photo?size=thumb');
    await act(async () => root.render(<MosaicPhoto object={object} width={400} />));
    await act(async () => { pending.shift()!(); await settle(); });
    assert.equal(src(), '/api/images/photo?size=grid');
  } finally {
    await act(async () => root.unmount());
    ui.cleanup();
  }
});
