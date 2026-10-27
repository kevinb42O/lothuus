import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { sessionCookieLifetime, rememberCookie, rememberedSessionSeconds, browserSessionSeconds } from './session-policy';

test('Supabase sign-in and refresh cookies follow the selected lifetime and preserve deletions', () => {
  const provider = { httpOnly: true, secure: true, path: '/', sameSite: 'lax' as const, maxAge: 400 * 86400, expires: new Date('2030-01-01') };
  const session = sessionCookieLifetime(provider, false);
  assert.equal(session.maxAge, undefined); assert.equal(session.expires, undefined);
  assert.equal(session.httpOnly, true); assert.equal(session.secure, true);
  const remembered = sessionCookieLifetime(provider, true);
  assert.equal(remembered.maxAge, rememberedSessionSeconds); assert.equal(remembered.expires, undefined);
  assert.equal(sessionCookieLifetime(remembered, false).maxAge, undefined);
  for (const remember of [false, true]) assert.equal(sessionCookieLifetime({ ...provider, maxAge: 0 }, remember).maxAge, 0);
});

test('login remember choice controls cookie persistence and token expiry; logout clears it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'lothuus-session-'));
  const previous = { data: process.env.LOTHUUS_DATA_DIR, mode: process.env.BACKEND_MODE, password: process.env.ADMIN_PASSWORD };
  Object.assign(process.env, { LOTHUUS_DATA_DIR: dir, BACKEND_MODE: 'local', ADMIN_PASSWORD: 'isolated-remember-test' });
  const { POST, DELETE } = await import('../../app/api/session/route');
  const { isOwner } = await import('./local-auth');
  const request = (body: unknown, cookie = '') => new NextRequest('https://example.test/api/session', { method: 'POST', headers: { origin: 'https://example.test', cookie }, body: JSON.stringify(body) });
  try {
    for (const remember of [false, true]) {
      const start = Date.now();
      const response = await POST(request({ password: 'isolated-remember-test', remember }));
      assert.equal(response.status, 200);
      const session = response.cookies.get('lothuus-owner')!;
      assert.ok(session.httpOnly); assert.ok(session.secure);
      assert.equal(session.maxAge, remember ? rememberedSessionSeconds : undefined);
      const expiry = Number(session.value.split('.')[0]);
      assert.ok(Math.abs(expiry - start - (remember ? rememberedSessionSeconds : browserSessionSeconds) * 1000) < 3000);
      assert.equal(isOwner(new NextRequest('https://example.test/api/store', { headers: { cookie: `lothuus-owner=${session.value}` } })), true);
      assert.equal(response.cookies.get(rememberCookie)!.maxAge, remember ? rememberedSessionSeconds : 0);
    }
    const renewed = await POST(request({ password: 'isolated-remember-test' }, `${rememberCookie}=1`));
    assert.equal(renewed.cookies.get('lothuus-owner')!.maxAge, rememberedSessionSeconds);
    const cleared = await POST(request({ password: 'isolated-remember-test', remember: false }, `${rememberCookie}=1`));
    assert.equal(cleared.cookies.get('lothuus-owner')!.maxAge, undefined);
    assert.equal((await POST(request({ password: 'isolated-remember-test', remember: 'false' }))).status, 400);
    const failed = await POST(request({ password: 'wrong-password', remember: true }));
    assert.equal(failed.status, 401); assert.equal(failed.cookies.get('lothuus-owner'), undefined);
    const logout = await DELETE(new NextRequest('https://example.test/api/session', { method: 'DELETE', headers: { origin: 'https://example.test' } }));
    assert.equal(logout.cookies.get('lothuus-owner')!.maxAge, 0); assert.equal(logout.cookies.get(rememberCookie)!.maxAge, 0);
  } finally {
    for (const [key, value] of Object.entries({ LOTHUUS_DATA_DIR: previous.data, BACKEND_MODE: previous.mode, ADMIN_PASSWORD: previous.password })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});
