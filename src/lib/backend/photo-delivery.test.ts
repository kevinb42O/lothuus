import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { publicPhotoRedirect } from './photo-delivery';

const id = '12345678-1234-1234-1234-123456789abc';
test('direct photos grant only a short GET for one variant, never a cacheable redirect', async () => {
  const values = { BACKEND_MODE: 'supabase', R2_DIRECT_DELIVERY: 'true', R2_ENDPOINT: 'https://abcdef.eu.r2.cloudflarestorage.com', R2_BUCKET: 'private-media', R2_ACCESS_KEY_ID: 'test-key', R2_SECRET_ACCESS_KEY: 'never-expose-this-secret' };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  try {
    const request = new NextRequest(`https://example.test/api/images/${id}?size=grid`);
    const response = await publicPhotoRedirect(request, id, 'grid');
    assert.equal(response?.status, 302);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('vary'), 'Cookie');
    const location = new URL(response.headers.get('location')!);
    assert.equal(location.origin, values.R2_ENDPOINT);
    assert.equal(location.pathname, `/private-media/variants/${id}-grid.webp`);
    assert.equal(location.searchParams.get('X-Amz-Expires'), '60');
    assert.equal(location.searchParams.get('X-Amz-SignedHeaders'), 'host');
    assert.equal(location.searchParams.get('response-cache-control'), 'private, no-cache');
    assert.ok(location.searchParams.get('X-Amz-Signature'));
    assert.ok(!location.href.includes(values.R2_SECRET_ACCESS_KEY));
    assert.equal(await publicPhotoRedirect(new NextRequest(request.url + '&delivery=proxy'), id, 'grid'), null);
    assert.equal(await publicPhotoRedirect(request, '../originals/private', 'grid'), null);
    process.env.R2_DIRECT_DELIVERY = 'false';
    assert.equal(await publicPhotoRedirect(request, id, 'grid'), null);
    process.env.R2_DIRECT_DELIVERY = 'true'; delete process.env.R2_SECRET_ACCESS_KEY;
    assert.equal(await publicPhotoRedirect(request, id, 'grid'), null);
    process.env.R2_SECRET_ACCESS_KEY = values.R2_SECRET_ACCESS_KEY;
    process.env.R2_ENDPOINT = 'https://untrusted.example.test';
    assert.equal(await publicPhotoRedirect(request, id, 'grid'), null);
  } finally {
    for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
