/** Dry run by default. --upload prepares R2 and backups; --apply also creates products and catalogue metadata. */
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { scanSource, batch, sourceDirectory, importRecord } from './lib/new-collection';
import { cloudMode, serverDatabase, withStore } from '../src/lib/backend/cloud';
import { savePhoto } from '../src/lib/backend/media';
import { developmentR2 } from '../src/lib/backend/r2-development';
import { validateBackup } from '../src/lib/maintenance/backup-format';
import type { CollectionObject } from '../src/lib/collection';
import type { Photo } from '../src/lib/backend/types';

type Manifest = { batch: string; source: Awaited<ReturnType<typeof scanSource>>; photos: Record<string, Photo & { sha256: string }>; products: Record<string, { id: string; productNumber?: string }>; backup?: string };
async function main() {
  const apply = process.argv.includes('--apply'), upload = apply || process.argv.includes('--upload');
  const root = resolve(sourceDirectory), path = resolve(`.data/${batch}.json`), records = await scanSource(root);
  const manifest: Manifest = existsSync(path) ? JSON.parse(await readFile(path, 'utf8')) : { batch, source: records, photos: {}, products: {} };
  assert.equal(manifest.batch, batch);
  assert.deepEqual(manifest.source, records, 'Bronbestanden zijn sinds de vorige uitvoering veranderd');
  const photos = records.flatMap(r => r.photos);
  console.log({ apply, upload, products: records.length, photos: photos.length, omitted: records.flatMap(r => r.omitted.map(file => ({ folder: r.folder, file }))), uploaded: Object.keys(manifest.photos).length, imported: Object.keys(manifest.products).length });
  if (!upload) return;
  assert(cloudMode(), 'Deze import vereist de bestaande Supabase-backend');
  await mkdir(resolve('.data'), { recursive: true, mode: 0o700 });
  let pending = Promise.resolve();
  const persist = () => pending = pending.then(async () => { await writeFile(path + '.tmp', JSON.stringify(manifest, null, 2), { mode: 0o600 }); await rename(path + '.tmp', path); });
  async function archive(key: string, body: Uint8Array) {
    const bucket = process.env.R2_BUCKET;
    process.env.R2_BUCKET = 'lothuus-backups';
    try {
      await developmentR2(key, 'PUT', body);
      const read = await developmentR2(key, 'GET');
      assert(read, 'Backup niet terugleesbaar');
      assert.equal(createHash('sha256').update(new Uint8Array(await read.arrayBuffer())).digest('hex'), createHash('sha256').update(body).digest('hex'), 'Backupchecksum wijkt af');
    } finally { process.env.R2_BUCKET = bucket; }
  }
  if (!manifest.backup) {
    const snapshot = await serverDatabase().rpc('lothuus_backup_state');
    if (snapshot.error) throw new Error(snapshot.error.message);
    const backup = validateBackup(snapshot.data);
    const key = `imports/${batch}-before.json`, body = new TextEncoder().encode(JSON.stringify(backup));
    await mkdir(resolve('.backups'), { recursive: true, mode: 0o700 });
    await writeFile(resolve(`.backups/${batch}-before.json`), body, { mode: 0o600, flag: 'wx' });
    await archive(key, body); manifest.backup = key; await persist();
    console.log({ backupVerified: key });
  }
  let cursor = 0, completed = Object.keys(manifest.photos).length;
  async function worker() {
    while (cursor < photos.length) {
      const source = photos[cursor++];
      if (manifest.photos[source.path]) { assert.equal(manifest.photos[source.path].sha256, source.sha256); continue; }
      const bytes = await readFile(resolve(root, source.path));
      const saved = await savePhoto(new File([new Uint8Array(bytes)], basename(source.path), { type: 'image/jpeg' }));
      manifest.photos[source.path] = { ...saved, alt: source.alt, sha256: source.sha256 }; await persist();
      if (++completed % 20 === 0) console.log({ uploaded: completed, total: photos.length });
    }
  }
  // Wait for all workers to finish even on failure before switching backup buckets.
  const results = await Promise.allSettled(Array.from({ length: 3 }, () => worker()));
  const failure = results.find(r => r.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
  if (!apply) { await archive(`imports/${batch}.json`, new TextEncoder().encode(JSON.stringify(manifest))); console.log({ uploadComplete: true }); return; }
  for (const record of records) {
    const photos = record.photos.map(p => { const { id, alt } = manifest.photos[p.path]; return { id, alt }; });
    const item = await withStore(s => importRecord(s, record, photos));
    manifest.products[record.reference] = { id: item.id, productNumber: item.productNumber }; await persist();
  }
  const cataloguePath = resolve('src/lib/collection.json');
  const existing: CollectionObject[] = JSON.parse(await readFile(cataloguePath, 'utf8'));
  const additions: CollectionObject[] = records.map(r => {
    const photos = r.photos.map(p => { const { id, alt } = manifest.photos[p.path]; return { id, alt, src: `/api/collection-images/${id}?size=detail` }; });
    return { id: r.reference, title: `${r.label} · ${r.reference}`, category: r.category, date: '', material: r.label, dimensions: '', maker: '', image: photos[0].src.replace('size=detail', 'size=grid'), source: '', credit: 'LOTHUUS', imageSource: `${sourceDirectory}/${r.folder}`, license: '', description: '', photos };
  });
  for (const record of additions) {
    const previous = existing.find(o => o.id === record.id);
    if (previous) assert.deepEqual(previous, record, 'Catalogusrecord gewijzigd; niet overschrijven'); else existing.push(record);
  }
  await writeFile(cataloguePath + '.tmp', JSON.stringify(existing, null, 2) + '\n'); await rename(cataloguePath + '.tmp', cataloguePath);
  await archive(`imports/${batch}.json`, new TextEncoder().encode(JSON.stringify(manifest)));
  console.log({ complete: true, products: Object.keys(manifest.products).length, photos: Object.keys(manifest.photos).length, catalogue: existing.length });
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
