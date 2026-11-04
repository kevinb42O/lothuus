import test from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';
import { setupDom, settle, button } from '../../test/dom';
import { operatorFixture as fixture } from '../../test/superadmin-fixture';

test('password login requires MFA before loading any operator data and stores no browser credentials', async () => {
 const ui = setupDom(), originalFetch = globalThis.fetch;
 const { createRoot } = await import('react-dom/client');
 const { Superadmin } = await import('./superadmin');
 const root = createRoot(ui.container);
 const requests: string[] = [];
 globalThis.fetch = async (url, options) => {
  requests.push(String(url));
  if (url === '/api/superadmin/report') return Response.json(fixture);
  assert.equal(url, '/api/superadmin/session');
  if (!options?.body) return Response.json({ authenticated: false });
  const body = JSON.parse(String(options.body));
  if (body.action === 'login') {
   assert.equal(body.email, 'operator@example.test');
   assert.equal(body.password, 'isolated-example-password');
   return Response.json({ authenticated: true, verified: false, factorId: '00000000-0000-4000-8000-000000000001' });
  }
  assert.equal(body.action, 'verify'); assert.equal(body.code, '123456');
  return Response.json({ authenticated: true, verified: true });
 };
 try {
  await act(async () => { root.render(<Superadmin />); await settle(); });
  const email = ui.container.querySelector<HTMLInputElement>('[name="email"]')!, password = ui.container.querySelector<HTMLInputElement>('[name="password"]')!;
  assert.equal(email.value, ''); assert.equal(password.value, '');
  email.value = 'operator@example.test'; password.value = 'isolated-example-password';
  await act(async () => { ui.container.querySelector('form')!.dispatchEvent(new ui.dom.window.Event('submit', { bubbles: true, cancelable: true })); await settle(); });
  assert.match(ui.container.textContent!, /Bevestig dat jij het bent/);
  assert.equal(requests.includes('/api/superadmin/report'), false);
  assert.equal(ui.container.querySelector('[name="password"]'), null);
  ui.container.querySelector<HTMLInputElement>('[name="code"]')!.value = '123456';
  await act(async () => { ui.container.querySelector('form')!.dispatchEvent(new ui.dom.window.Event('submit', { bubbles: true, cancelable: true })); await settle(); await settle(); });
  assert.equal(requests.includes('/api/superadmin/report'), true);
  assert.match(ui.container.textContent!, /Vintage vaas/);
  assert.equal(localStorage.length, 0); assert.equal(sessionStorage.length, 0);
 } finally { await act(async () => root.unmount()); globalThis.fetch = originalFetch; ui.cleanup(); }
});
test('technical report failures preserve activity and policy controls without making writes', async () => {
 const ui = setupDom(), originalFetch = globalThis.fetch;
 const { createRoot } = await import('react-dom/client');
 const { Dashboard } = await import('./superadmin');
 const root = createRoot(ui.container);
 let writes = 0;
 globalThis.fetch = async (_url, options) => { if (options?.method === 'POST') writes++; return Response.json(fixture); };
 try {
  await act(async () => { root.render(<Dashboard onExpired={() => {}} onLogout={async () => {}} />); await settle(); });
  assert.match(ui.container.textContent!, /Nieuwe toevoegingen geblokkeerd/);
  assert.match(ui.container.textContent!, /Technische metingen zijn tijdelijk niet beschikbaar/);
  assert.match(ui.container.textContent!, /Niet bevestigd/);
  await act(async () => { button(ui.container, 'Pakket & rechten').click(); });
  assert.match(ui.container.textContent!, /Objectrechten opslaan/);
  assert.equal(ui.container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked, true);
  assert.equal(writes, 0);
 } finally { await act(async () => root.unmount()); globalThis.fetch = originalFetch; ui.cleanup(); }
});
