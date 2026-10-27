import test from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react';
import { setupDom, settle } from '../../test/dom';

test('login starts with empty credentials and sends the unchecked or checked remember choice', async () => {
  const ui = setupDom(), originalFetch = globalThis.fetch;
  const { createRoot } = await import('react-dom/client');
  const { Admin } = await import('./admin');
  const root = createRoot(ui.container);
  const sent: Record<string, unknown>[] = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/session');
    if (options?.method === 'POST') {
      sent.push(JSON.parse(String(options.body)));
      return Response.json({ error: 'Test: blijf op het formulier.' }, { status: 401 });
    }
    return Response.json({ authenticated: false, configured: true, local: false, email: 'must-not-prefill@example.test' });
  };
  try {
    await act(async () => { root.render(<Admin />); await settle(); });
    const email = ui.container.querySelector<HTMLInputElement>('input[name="email"]')!;
    const password = ui.container.querySelector<HTMLInputElement>('input[name="password"]')!;
    const remember = ui.container.querySelector<HTMLInputElement>('input[name="remember"]')!;
    assert.equal(email.value, ''); assert.equal(password.value, ''); assert.equal(remember.checked, false);
    assert.match(ui.container.textContent!, /Onthoud mij/);
    email.value = 'owner@example.test'; password.value = 'isolated-password';
    const submit = () => act(async () => { ui.container.querySelector('form')!.dispatchEvent(new ui.dom.window.Event('submit', { bubbles: true, cancelable: true })); await settle(); });
    await submit(); assert.equal(sent[0].remember, false);
    await act(async () => { remember.click(); });
    await submit(); assert.equal(sent[1].remember, true);
    assert.equal(sent[1].email, 'owner@example.test'); assert.equal(sent[1].password, 'isolated-password');
    assert.equal(localStorage.length, 0);
  } finally { await act(async () => root.unmount()); globalThis.fetch = originalFetch; ui.cleanup(); }
});
