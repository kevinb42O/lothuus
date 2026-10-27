import test from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';
import { setupDom, settle } from '../../test/dom';

test('dashboard shows the exact overage without blocking actions and updates after saving', async () => {
  const ui = setupDom(), originalFetch = globalThis.fetch;
  const { createRoot } = await import('react-dom/client');
  const { CapacityNotice } = await import('./capacity-notice');
  const root = createRoot(ui.container); let opened = false; let overLimit = false;
  const onOverLimitChange = (over: boolean) => { overLimit = over; };
  globalThis.fetch = async () => Response.json({ limit: 200 });
  const render = async (count: number) => act(async () => { root.render(<CapacityNotice count={count} onCapacity={() => { opened = true; }} onOverLimitChange={onOverLimitChange} />); await settle(); });
  try {
    await render(195); assert.equal(ui.container.textContent, ''); assert.equal(overLimit, false);
    await render(297); assert.equal(overLimit, true); assert.match(ui.container.textContent!, /297 van 200 objecten · 97 boven/);
    assert.match(ui.container.textContent!, /Breid je capaciteit uit of kies een groter pakket/);
    await act(async () => ui.container.querySelector('button')!.click()); assert.equal(opened, true);
    await render(298); assert.match(ui.container.textContent!, /98 boven/);
    await render(200); assert.equal(ui.container.textContent, ''); assert.equal(overLimit, false);
  } finally { await act(async () => root.unmount()); globalThis.fetch = originalFetch; ui.cleanup(); }
});


test('hosting keeps one shared over-limit notice and explains Free inactivity pausing', async () => {
  const ui = setupDom(), originalFetch = globalThis.fetch;
  const { createRoot } = await import('react-dom/client');
  const { CapacityNotice } = await import('./capacity-notice');
  const { Hosting } = await import('./hosting');
  const root = createRoot(ui.container);
  const metric = { value: null, measuredAt: null, status: 'unavailable' };
  globalThis.fetch = async () => Response.json({ plan: 'basis', count: 297, limit: 200, extra: 0, validUntil: null, orders: [], metrics: { media: metric, database: metric, direct: metric, cached: metric } });
  try {
    await act(async () => { root.render(<><CapacityNotice count={297} onCapacity={() => {}} /><Hosting /></>); await settle(); });
    assert.equal(ui.container.querySelectorAll('.a-capacity-notice').length, 1);
    assert.equal(ui.container.querySelectorAll('.hc-limit-alert').length, 0);
    assert.equal(ui.container.textContent!.match(/Je collectie is groter dan je huidige pakket/g)?.length, 1);
    const cards = ui.container.querySelectorAll('.hc-plan');
    assert.match(cards[0].textContent!, /automatisch gepauzeerd, vanaf 7 dagen/);
    assert.match(cards[0].textContent!, /objectuitbreidingen veranderen niets/);
    for (const card of [cards[1], cards[2]]) assert.match(card.textContent!, /Geen automatische pauzering bij inactiviteit/);
  } finally { await act(async () => root.unmount()); globalThis.fetch = originalFetch; ui.cleanup(); }
});
