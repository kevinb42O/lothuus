import test from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';
import { setupDom, settle, button } from '../test/dom';
import { initialStore } from '../lib/backend/repository';
import { checkout } from '../lib/backend/service';
import { objects } from '../lib/collection';
import type { CheckoutAttempt } from './reservation';

test('an active reservation refreshes at a bounded pace and stops after a terminal response', async t => {
  const ui = setupDom(), originalFetch = globalThis.fetch;
  Object.defineProperty(document,'hidden',{value:false,configurable:true});
  const { createRoot } = await import('react-dom/client');
  const { ReservationConfirmation } = await import('./reservation');
  const root = createRoot(ui.container); let requests = 0;
  const result = { id:'reservation',reference:'LT-TEST',title:'Object',priceCents:1000,paidCents:0,paymentPending:true,status:'active',deadline:new Date().toISOString(),bank:{beneficiary:'',iban:'',instructions:''},local:true,token:'a'.repeat(64) };
  globalThis.fetch = async () => { requests++; return Response.json({...result,status:'completed'}); };
  t.mock.timers.enable({apis:['setTimeout']});
  try {
    await act(async()=>{root.render(<ReservationConfirmation result={result}/>);});
    await act(async()=>{t.mock.timers.tick(15000);await settle();});assert.equal(requests,0);
    await act(async()=>{t.mock.timers.tick(45000);await settle();});assert.equal(requests,1);
    await act(async()=>{t.mock.timers.tick(3600000);await settle();});assert.equal(requests,1);
    assert.match(ui.container.textContent||'',/Bedankt voor je aankoop/);
  } finally { await act(async()=>root.unmount());t.mock.timers.reset();globalThis.fetch=originalFetch;ui.cleanup(); }
});

test('a lost checkout response is recovered after the catalogue changes and the dialog reopens', async () => {
  const ui = setupDom(), originalFetch = globalThis.fetch;
  const { createRoot } = await import('react-dom/client');
  const { SelectionDialog } = await import('./reservation');
  let root = createRoot(ui.container);
  const store = initialStore(), attempt: { current: CheckoutAttempt | null } = { current: null }, requests: object[] = [];
  ui.dom.window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia;
  let failFirst!: () => void;
  let ordered: string[] = [];
  const available = { ...objects[0], version: 1, availability: 'available' as const };
  const settings = { ...store.settings, acceptsReservations: true, ready: false };
  const render = (reserved = false) => <SelectionDialog objects={[{ ...available, availability: reserved ? 'reserved' : 'available' }]} settings={{ ...settings, acceptsReservations: !reserved, termsVersion: reserved ? 'changed' : settings.termsVersion }} draft={{ name: 'Test Klant', email: 'customer@example.test', phone: '', message: '' }} onDraft={() => {}} attempt={attempt} onClose={() => {}} onRemove={() => {}} onOpen={() => {}} onOrdered={ids => { ordered = ids; }} onRefresh={() => {}} />;
  globalThis.fetch = async (_url, options) => {
    const payload = JSON.parse(String(options?.body)); requests.push(payload);
    const result = checkout(store, payload);
    if (requests.length === 1) return new Promise<Response>((_resolve, reject) => { failFirst = () => reject(new TypeError('Connection lost after the server committed')); });
    return Response.json(result);
  };
  try {
    await act(async () => { root.render(render()); });
    await act(async () => { button(ui.container, 'Verder naar reserveren').click(); });
    const form = ui.container.querySelector<HTMLFormElement>('.checkout-form')!;
    form.querySelector<HTMLInputElement>('[name="accepted"]')!.checked = true;
    await act(async () => { form.dispatchEvent(new ui.dom.window.Event('submit', { bubbles: true, cancelable: true })); await settle(); });
    assert.equal(ui.container.querySelector<HTMLButtonElement>('.close-dialog')!.disabled, true);
    await act(async () => { ui.container.querySelector('dialog')!.dispatchEvent(new ui.dom.window.Event('cancel', { cancelable: true })); });
    assert.equal(ui.container.querySelector('dialog')!.classList.contains('is-closing'), false);
    await act(async () => { failFirst(); await settle(); });
    assert.equal(store.reservations.length, 1);
    assert.equal(attempt.current?.unconfirmed, true);
    assert.equal(button(ui.container, 'Bevestiging opnieuw ophalen').disabled, false);
    await act(async () => { root.unmount(); });
    root = createRoot(ui.container);
    await act(async () => { root.render(render(true)); });
    await act(async () => { button(ui.container, 'Bevestiging opnieuw ophalen').click(); await settle(); });
    assert.deepEqual(requests[1], requests[0]);
    assert.equal(store.reservations.length, 1);
    assert.deepEqual(ordered, [available.id]);
    assert.match(ui.container.textContent || '', /Voor jou gereserveerd/);
    assert.equal(attempt.current, null);
  } finally { await act(async () => { root.unmount(); }); globalThis.fetch = originalFetch; ui.cleanup(); }
});

test('the private reservation fragment survives a failed request, retry and page remount', async () => {
  const token = 'a'.repeat(64), ui = setupDom(`http://localhost:3000/reservation#${token}`), originalFetch = globalThis.fetch;
  const { createRoot } = await import('react-dom/client');
  const { default: ReservationPage } = await import('../app/reservation/page');
  let root = createRoot(ui.container), requests = 0;
  globalThis.fetch = async (_url, options) => {
    assert.equal(JSON.parse(String(options?.body)).token, token); requests++;
    if (requests === 1) throw new TypeError('Offline');
    return Response.json({ id: 'reservation', reference: 'LT-TEST', title: 'Object', priceCents: 1000, paidCents: 0, paymentPending: true, status: 'active', deadline: new Date().toISOString(), bank: {}, local: true });
  };
  try {
    await act(async () => { root.render(<ReservationPage />); await settle(); });
    assert.equal(ui.dom.window.location.hash, `#${token}`);
    await act(async () => { button(ui.container, 'Opnieuw proberen').click(); await settle(); });
    assert.match(ui.container.textContent || '', /LT-TEST/);
    await act(async () => { root.unmount(); }); root = createRoot(ui.container);
    await act(async () => { root.render(<ReservationPage />); await settle(); });
    assert.equal(requests, 3); assert.equal(ui.dom.window.location.hash, `#${token}`);
    assert.match(ui.container.textContent || '', /LT-TEST/);
  } finally { await act(async () => { root.unmount(); }); globalThis.fetch = originalFetch; ui.cleanup(); }
});
