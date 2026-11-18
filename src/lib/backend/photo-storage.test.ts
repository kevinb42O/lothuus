import test from 'node:test';
import assert from 'node:assert/strict';
import { S3Client } from '@aws-sdk/client-s3';
import { readStoredPhoto } from './photo-storage';

test('storage reuses one client and byte fetch, separates variants and resets on configuration changes', async t => {
  const values = { R2_ENDPOINT: 'https://abcdef.eu.r2.cloudflarestorage.com', R2_BUCKET: 'test-photos', R2_ACCESS_KEY_ID: 'test-key', R2_SECRET_ACCESS_KEY: 'test-secret' };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  let failBody = false;
  const calls: { client: S3Client; bucket: string; key: string }[] = [];
  t.mock.method(S3Client.prototype, 'send', async function(this: S3Client, command: { input: { Bucket: string; Key: string } }) {
    calls.push({ client: this, bucket: command.input.Bucket, key: command.input.Key });
    return { Body: { transformToByteArray: async () => { if (failBody) throw new Error('truncated body'); return new Uint8Array([1, 2, 3]); } } };
  });
  try {
    await Promise.all([readStoredPhoto('photo', 'grid'), readStoredPhoto('photo', 'grid')]);
    await readStoredPhoto('photo', 'grid'); assert.equal(calls.length, 1);
    await readStoredPhoto('photo', 'thumb'); assert.equal(calls.length, 2);
    assert.equal(calls[0].client, calls[1].client);
    assert.equal(calls[1].key, 'variants/photo-thumb.webp');
    process.env.R2_BUCKET = 'other-photos';
    await readStoredPhoto('photo', 'grid'); assert.equal(calls.length, 3);
    assert.equal(calls[2].bucket, 'other-photos'); assert.notEqual(calls[2].client, calls[0].client);
    process.env.R2_SECRET_ACCESS_KEY = 'rotated-test-secret';
    await readStoredPhoto('photo', 'grid'); assert.equal(calls.length, 4);
    failBody = true;
    const failed = await Promise.allSettled([readStoredPhoto('broken-photo', 'grid'), readStoredPhoto('broken-photo', 'grid')]);
    assert.ok(failed.every(result => result.status === 'rejected'));
    assert.equal(calls.length, 5);
    failBody = false;
    assert.deepEqual(await readStoredPhoto('broken-photo', 'grid'), new Uint8Array([1, 2, 3]));
    assert.equal(calls.length, 6, 'an interrupted body is fetched again, never cached partially');
    delete process.env.R2_ACCESS_KEY_ID;
    await assert.rejects(readStoredPhoto('photo', 'grid'), /Foto-opslag/);
  } finally {
    for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
