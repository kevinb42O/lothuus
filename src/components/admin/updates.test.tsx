import test from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';
import { setupDom, settle, button } from '../../test/dom';
import type { WorkspaceUpdate } from '../../lib/updates/types';

const update: WorkspaceUpdate = { id: 'test-update', date: '2026-10-27', title: 'Je nieuwe producten zijn toegevoegd', body: ['Je kunt je collectie aanvullen.'], action: { label: 'Producten bekijken', target: 'items' } };

test('overview stays unread; opening updates remembers them, preserves arrival labels and supports rereading', async () => {
  const ui = setupDom(), previousFetch = globalThis.fetch;
  const { createRoot } = await import('react-dom/client');
  const { useUpdates, Updates, LatestUpdate } = await import('./updates');
  const { useState } = await import('react');
  const root = createRoot(ui.container);
  let calls = 0, target = '';
  globalThis.fetch = async () => { calls++; return Response.json({ updates: [update] }); };
  function Harness() {
    const state = useUpdates(true), [open, setOpen] = useState(false);
    return <><span data-unread>{state.updates.some(item => !state.viewed.includes(item.id)) ? 'unread' : 'read'}</span><button onClick={() => setOpen(false)}>Overzicht</button>{open ? <Updates state={state} onNavigate={value => { target = value; }} /> : <LatestUpdate state={state} onOpen={() => setOpen(true)} />}</>;
  }
  try {
    await act(async () => { root.render(<Harness />); await settle(); });
    assert.equal(ui.container.querySelector('[data-unread]')!.textContent, 'unread');
    assert.equal(localStorage.length, 0);
    await act(async () => { button(ui.container, 'Alle updates bekijken').click(); });
    assert.equal(ui.container.querySelector('[data-unread]')!.textContent, 'read');
    assert.equal(ui.container.querySelector('.au-new')!.textContent, 'Nieuw');
    assert.match(localStorage.getItem('lothuus-updates-viewed-v1')!, /test-update/);
    await act(async () => { button(ui.container, 'Producten bekijken').click(); });
    assert.equal(target, 'items');
    await act(async () => { button(ui.container, 'Overzicht').click(); });
    await act(async () => { button(ui.container, 'Alle updates bekijken').click(); });
    assert.equal(ui.container.querySelector('.au-new'), null);
    assert.match(ui.container.textContent!, /Je kunt je collectie aanvullen/);
    assert.equal(calls, 1);
  } finally { await act(async () => root.unmount()); globalThis.fetch = previousFetch; ui.cleanup(); }
});

test('failed loading can be retried and never marks updates viewed; logout discards data', async () => {
  const ui = setupDom(), previousFetch = globalThis.fetch;
  const { createRoot } = await import('react-dom/client');
  const { useUpdates, Updates } = await import('./updates');
  const { useState } = await import('react');
  const root = createRoot(ui.container);
  let calls = 0;
  globalThis.fetch = async () => ++calls === 1 ? Response.json({ error: 'offline' }, { status: 503 }) : Response.json({ updates: [update] });
  function Harness() {
    const [authenticated, setAuthenticated] = useState(true), state = useUpdates(authenticated);
    return <><button onClick={() => setAuthenticated(false)}>Uitloggen</button>{authenticated && <Updates state={state} onNavigate={() => {}} />}<span data-count>{state.updates.length}</span></>;
  }
  try {
    await act(async () => { root.render(<Harness />); await settle(); });
    assert.match(ui.container.textContent!, /De updates konden niet worden geladen/);
    assert.equal(localStorage.length, 0);
    await act(async () => { button(ui.container, 'Opnieuw proberen').click(); await settle(); });
    assert.match(ui.container.textContent!, /Je nieuwe producten/);
    await act(async () => { button(ui.container, 'Uitloggen').click(); });
    assert.equal(ui.container.querySelector('[data-count]')!.textContent, '0');
  } finally { await act(async () => root.unmount()); globalThis.fetch = previousFetch; ui.cleanup(); }
});
