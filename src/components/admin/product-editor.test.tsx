import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { act } from 'react';
import { setupDom, settle } from '../../test/dom';
import { initialStore } from '../../lib/backend/repository';
import { MAX_PHOTO_BYTES } from '../../lib/media-limits';
import type { Item } from '../../lib/backend/types';

test('an upload-only expired session can sign in with the configured owner and resume its queue', async () => {
  const ui = setupDom(), originalFetch = globalThis.fetch;
  const { createRoot } = await import('react-dom/client');
  const { ProductEditor } = await import('./product-editor');
  const { ToastProvider } = await import('./toasts');
  const root = createRoot(ui.container), store = initialStore();
  const item: Item = { id: randomUUID(), title: 'Test', category: 'objecten', description: '', priceCents: 1000, date: '', material: '', dimensions: '', maker: '', condition: '', publication: 'draft', materialGroup: 'K', productNumber: 'K1', photos: [], version: 1, createdAt: new Date().toISOString() };
  store.items.push(item);
  const photo = { id: randomUUID(), alt: 'Nieuwe foto' }; let uploads = 0, saves = 0;
  globalThis.fetch = async (url, options) => {
    if (url === '/api/session') { assert.equal(JSON.parse(String(options?.body)).email, 'configured-owner@example.test'); return Response.json({ authenticated: true }); }
    if (url === '/api/images') { uploads++; return uploads === 1 ? Response.json({ error: 'Log opnieuw in.' }, { status: 401 }) : Response.json(photo); }
    assert.equal(url, '/api/store'); saves++;
    const request = JSON.parse(String(options?.body)); assert.equal(request.action, 'save-item-photos');
    return Response.json({ ...store, items: [{ ...item, version: 2, photos: request.photos }] });
  };
  try {
    await act(async () => { root.render(<ToastProvider><ProductEditor item={item} store={store} accountEmail="configured-owner@example.test" onDirect={async () => {}} onData={() => {}} onBack={() => {}} onNext={() => {}} registerLeave={() => {}} /></ToastProvider>); });
    const input = ui.container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { configurable: true, value: [new ui.dom.window.File([new Uint8Array(MAX_PHOTO_BYTES + 1)], 'large.jpg', { type: 'image/jpeg' })] });
    await act(async () => { input.dispatchEvent(new ui.dom.window.Event('change', { bubbles: true })); });
    assert.equal(uploads, 0); assert.match(ui.container.textContent || '', /maximaal 4 MB/);
    Object.defineProperty(input, 'files', { configurable: true, value: [new ui.dom.window.File(['photo'], 'photo.jpg', { type: 'image/jpeg' })] });
    await act(async () => { input.dispatchEvent(new ui.dom.window.Event('change', { bubbles: true })); await settle(); });
    const renewal = ui.container.querySelector<HTMLFormElement>('.pe-session'); assert.ok(renewal);
    renewal.querySelector<HTMLInputElement>('[name="password"]')!.value = 'test-password';
    await act(async () => { renewal.dispatchEvent(new ui.dom.window.Event('submit', { bubbles: true, cancelable: true })); await settle(); await settle(); });
    assert.equal(uploads, 2); assert.equal(saves, 1);
    assert.equal(ui.container.querySelector('.pe-session'), null);
    assert.ok(ui.container.querySelector('img[alt="Nieuwe foto"]'));
  } finally { await act(async () => { root.unmount(); }); globalThis.fetch = originalFetch; ui.cleanup(); }
});
