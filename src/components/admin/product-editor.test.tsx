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

test('a stale new-product form keeps its text, photos and recovery copy when capacity rejects saving', async () => {
  const ui = setupDom(), originalFetch = globalThis.fetch;
  const { createRoot } = await import('react-dom/client');
  const { ProductEditor } = await import('./product-editor');
  const { ToastProvider } = await import('./toasts');
  const { OBJECT_LIMIT_MESSAGE } = await import('../../lib/hosting/capacity');
  const root = createRoot(ui.container);
  const photo = { id: randomUUID(), alt: 'Bewaarde foto' };
  const draft = { title: 'Onvoltooide vaas', description: 'Mijn eigen tekst', date: '', dimensions: '', condition: '', price: '', maker: '', material: '', materialGroup: 'K', category: 'keramiek', publication: 'draft', photos: [photo], editorReady: false };
  localStorage.setItem('lothuus:product:new', JSON.stringify({ draft, creationKey: randomUUID() }));
  let saved = false, next = false;
  globalThis.fetch = async () => Response.json({ error: OBJECT_LIMIT_MESSAGE }, { status: 409 });
  try {
    await act(async () => { root.render(<ToastProvider><ProductEditor store={initialStore()} accountEmail="" onDirect={async () => {}} onData={() => { saved = true; }} onBack={() => {}} onNext={() => { next = true; }} registerLeave={() => {}} /></ToastProvider>); await settle(); });
    const restore = [...ui.container.querySelectorAll('button')].find(b => b.textContent === 'Invoer herstellen')!;
    await act(async () => { restore.click(); });
    const finish = [...ui.container.querySelectorAll('button')].find(b => b.textContent?.includes('Opslaan en volgend product'))!;
    await act(async () => { finish.click(); await settle(); });
    assert.match(ui.container.textContent!, /Je pakketlimiet is bereikt/);
    assert.equal(ui.container.querySelector<HTMLInputElement>('#product-title')!.value, draft.title);
    assert.ok(ui.container.querySelector('img[alt="Bewaarde foto"]'));
    const recovery = JSON.parse(localStorage.getItem('lothuus:product:new')!);
    assert.equal(recovery.draft.description, draft.description);
    assert.deepEqual(recovery.draft.photos, [photo]);
    assert.equal(saved, false); assert.equal(next, false);
  } finally { await act(async () => root.unmount()); globalThis.fetch = originalFetch; ui.cleanup(); }
});

test('saving other details preserves a legacy material description without showing its input', async () => {
  const ui = setupDom(), originalFetch = globalThis.fetch;
  const { createRoot } = await import('react-dom/client');
  const { ProductEditor } = await import('./product-editor');
  const { ToastProvider } = await import('./toasts');
  const root = createRoot(ui.container), store = initialStore();
  const item: Item = { id: randomUUID(), title: 'Vaas', category: 'keramiek', description: '', priceCents: 1000, date: '', material: 'Geglazuurd aardewerk', dimensions: '', maker: '', condition: '', publication: 'draft', materialGroup: 'K', productNumber: 'K1', photos: [], version: 1, createdAt: new Date().toISOString() };
  store.items.push(item);
  let saves = 0;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/store');
    const request = JSON.parse(String(options?.body));
    assert.equal(request.action, 'save-item');
    assert.equal(request.item.material, item.material);
    assert.equal(request.item.category, item.category);
    assert.equal(request.item.materialGroup, item.materialGroup);
    assert.equal(request.item.title, 'Vaas aangepast');
    saves++;
    return Response.json({ ...store, items: [{ ...item, ...request.item, version: 2 }] });
  };
  try {
    await act(async () => root.render(<ToastProvider><ProductEditor item={item} store={store} accountEmail="" onDirect={async () => {}} onData={() => {}} onBack={() => {}} onNext={() => {}} registerLeave={() => {}} /></ToastProvider>));
    assert.equal(ui.container.querySelector('#product-material'), null);
    assert.doesNotMatch(ui.container.textContent!, /Materiaalomschrijving/);
    const title = ui.container.querySelector<HTMLInputElement>('#product-title')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(ui.dom.window.HTMLInputElement.prototype, 'value')!.set!.call(title, 'Vaas aangepast');
      title.dispatchEvent(new ui.dom.window.Event('input', { bubbles: true }));
    });
    await act(async () => {
      ui.container.querySelector('form.pe-form')!.dispatchEvent(new ui.dom.window.Event('submit', { bubbles: true, cancelable: true }));
      await settle();
    });
    assert.equal(saves, 1);
  } finally { await act(async () => root.unmount()); globalThis.fetch = originalFetch; ui.cleanup(); }
});
