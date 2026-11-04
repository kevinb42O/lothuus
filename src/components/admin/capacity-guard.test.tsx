import test from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';
import { setupDom, settle, button } from '../../test/dom';
import { initialStore } from '../../lib/backend/repository';
import { invalidateStoreCache } from '../../lib/admin-client';

test('adding checks live capacity, preserves the current screen, and opens packages on request', async () => {
  const ui = setupDom(), originalFetch = globalThis.fetch;
  ui.dom.window.scrollTo = () => {};
  const { createRoot } = await import('react-dom/client');
  const { Admin } = await import('./admin');
  const root = createRoot(ui.container);
  let count = 304, unavailable = false, writes = 0;
  const store = initialStore();
  globalThis.fetch = async (url, options) => {
    if (url === '/api/admin/usage') return Response.json({recorded:true});
    if (url === '/api/admin/capacity-attempt') return Response.json({ recorded: true });
    if (options?.method === 'POST') writes++;
    if (url === '/api/session') return Response.json({ authenticated: true, configured: true, local: true });
    if (url === '/api/store') return Response.json(store);
    if (url === '/api/updates') return Response.json({ updates: [] });
    if (String(url).startsWith('/api/admin/hosting')) return unavailable ? Response.json({ error: 'Tijdelijk niet bereikbaar.' }, { status: 503 }) : Response.json({ count, limit: 200, plan: 'basis', extra: 0, orders: [], metrics: { media: {}, database: {}, direct: {}, cached: {} } });
    throw new Error(`Unexpected request: ${url}`);
  };
  const clickAdd = () => act(async () => { button(ui.container, 'Product toevoegen').click(); await settle(); });
  try {
    invalidateStoreCache();
    await act(async () => { root.render(<Admin />); await settle(); await settle(); });
    for (count of [304, 200]) {
      await clickAdd();
      const dialog = ui.container.querySelector('dialog')!;
      assert.ok(dialog.open);
      assert.match(dialog.textContent!, /Je pakketlimiet is bereikt/);
      assert.match(dialog.textContent!, new RegExp(`${count} objecten`));
      assert.equal(ui.container.querySelector('.pe-form'), null);
      await act(async () => { button(dialog, 'Sluiten').click(); });
    }
    await clickAdd();
    await act(async () => { button(ui.container.querySelector('dialog')!, 'Bekijk de pakketten').click(); await settle(); });
    assert.match(ui.container.textContent!, /Hosting & websitebeheer/);
    assert.equal(ui.container.querySelector('dialog'), null);
    unavailable = true;
    await clickAdd();
    assert.match(ui.container.textContent!, /Tijdelijk niet bereikbaar/);
    assert.equal(ui.container.querySelector('.pe-form'), null);
    unavailable = false; count = 199;
    await clickAdd();
    assert.ok(ui.container.querySelector('input#product-title'));
    assert.equal(writes, 0);
  } finally {
    await act(async () => root.unmount());
    invalidateStoreCache(); globalThis.fetch = originalFetch; ui.cleanup();
  }
});

test('saving the last available draft while leaving does not open another empty product editor', async () => {
  const ui = setupDom(), originalFetch = globalThis.fetch;
  ui.dom.window.scrollTo = () => {};
  const { createRoot } = await import('react-dom/client');
  const { Admin } = await import('./admin');
  const root = createRoot(ui.container);
  const store = initialStore();
  const draft = { title: 'Laatste vrije plaats', description: 'Invoer bewaren', date: '', dimensions: '', condition: '', price: '', maker: '', material: '', materialGroup: 'K', category: 'keramiek', publication: 'draft', photos: [], editorReady: false };
  let count = 199, saves = 0;
  globalThis.fetch = async (url, options) => {
    if (url === '/api/admin/usage') return Response.json({recorded:true});
    if (url === '/api/admin/capacity-attempt') return Response.json({ recorded: true });
    if (url === '/api/session') return Response.json({ authenticated: true, configured: true, local: true });
    if (url === '/api/updates') return Response.json({ updates: [] });
    if (String(url).startsWith('/api/admin/hosting')) return Response.json({ count, limit: 200, plan: 'basis' });
    if (url === '/api/store' && options?.method === 'POST') {
      saves++;
      const { item } = JSON.parse(String(options.body));
      const record = { ...item, id: 'saved-last-slot', version: 1, productNumber: 'K200', createdAt: new Date().toISOString() };
      count = 200;
      store.items = Array.from({ length: 200 }, (_, n) => ({ ...record, id: n === 0 ? record.id : `existing-${n}`, creationKey: n === 0 ? record.creationKey : undefined }));
      return Response.json(store);
    }
    if (url === '/api/store') return Response.json(store);
    throw new Error(`Unexpected request: ${url}`);
  };
  try {
    invalidateStoreCache();
    localStorage.setItem('lothuus:product:new', JSON.stringify({ draft, creationKey: crypto.randomUUID() }));
    await act(async () => { root.render(<Admin />); await settle(); await settle(); });
    await act(async () => { button(ui.container, 'Product toevoegen').click(); await settle(); });
    await act(async () => { button(ui.container, 'Invoer herstellen').click(); });
    await act(async () => { button(ui.container, 'Product toevoegen').click(); await settle(); await settle(); });
    assert.equal(saves, 1);
    assert.ok(ui.container.querySelector('dialog[open]'), 'the draft filled slot 200; show the capacity dialog');
    assert.equal(ui.container.querySelector<HTMLInputElement>('#product-title')!.value, draft.title);
    assert.equal(store.items.length, 200);

  } finally { await act(async () => root.unmount()); invalidateStoreCache(); globalThis.fetch = originalFetch; ui.cleanup(); }
});
