import test from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';
import { setupDom, settle } from '../../test/dom';

test('dashboard shows the exact overage without blocking actions and updates after saving', async () => {
  const ui = setupDom(), originalFetch = globalThis.fetch;
  const { createRoot } = await import('react-dom/client');
  const { CapacityNotice } = await import('./capacity-notice');
  const root = createRoot(ui.container); let opened = false;
  globalThis.fetch = async () => Response.json({ limit: 200 });
  const render = async (count: number) => act(async () => { root.render(<CapacityNotice count={count} onCapacity={() => { opened = true; }} />); await settle(); });
  try {
    await render(195); assert.equal(ui.container.textContent, '');
    await render(297); assert.match(ui.container.textContent!, /297 van 200 objecten · 97 boven/);
    assert.match(ui.container.textContent!, /Breid je capaciteit uit of kies een groter pakket/);
    await act(async () => ui.container.querySelector('button')!.click()); assert.equal(opened, true);
    await render(298); assert.match(ui.container.textContent!, /98 boven/);
    await render(200); assert.equal(ui.container.textContent, '');
  } finally { await act(async () => root.unmount()); globalThis.fetch = originalFetch; ui.cleanup(); }
});
