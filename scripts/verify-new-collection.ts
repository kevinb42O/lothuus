/** Verifies every retained R2 original and variant, database reference, and existing item. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { batch } from './lib/new-collection';
import { serverDatabase } from '../src/lib/backend/cloud';
import { developmentR2 } from '../src/lib/backend/r2-development';
import { validateBackup } from '../src/lib/maintenance/backup-format';
import type { Store, Photo } from '../src/lib/backend/types';

async function main() {
  const manifest = JSON.parse(await readFile(`.data/${batch}.json`, 'utf8')) as { source: { reference: string; photos: { path: string; sha256: string }[] }[]; photos: Record<string, Photo & { sha256: string }>; products: Record<string, { id: string; productNumber: string }> };
  const before = validateBackup(JSON.parse(await readFile(`.backups/${batch}-before.json`, 'utf8')));
  const snapshot = await serverDatabase().rpc('lothuus_backup_state');
  if (snapshot.error) throw new Error(snapshot.error.message);
  const backup = validateBackup(snapshot.data), state = backup.tables.store[0].body as Store;
  const old = before.tables.store[0].body as Store;
  for (const item of old.items) assert.deepEqual(state.items.find(i => i.id === item.id), item, `Bestaande fiche gewijzigd: ${item.productNumber}`);
  const media = new Set(backup.tables.media.map(m => m.id));
  for (const record of manifest.source) {
    const imported = manifest.products[record.reference]; assert(imported);
    const item = state.items.find(i => i.id === imported.id)!; assert(item);
    assert.equal(item.sourceReference, record.reference); assert.equal(item.productNumber, imported.productNumber);
    assert(item.photos.length <= 8); assert.equal(item.sourcePhotos?.length, record.photos.length);
    for (const source of record.photos) {
      const photo = manifest.photos[source.path]; assert(photo); assert(media.has(photo.id));
      assert(item.sourcePhotos?.some(p => p.id === photo.id)); assert.equal(photo.sha256, source.sha256);
    }
  }
  const photos = Object.values(manifest.photos); let cursor = 0, verified = 0, storedBytes = 0;
  async function worker() {
    while (cursor < photos.length) {
      const photo = photos[cursor++];
      for (const size of ['original', 'thumb', 'grid', 'detail'] as const) {
        const key = size === 'original' ? `originals/${photo.id}` : `variants/${photo.id}-${size}.webp`;
        let bytes: Uint8Array | undefined;
        for (let attempt = 0; attempt < 3; attempt++) {
          try { const response = await developmentR2(key, 'GET'); assert(response, `Ontbrekend R2-object: ${key}`); bytes = new Uint8Array(await response.arrayBuffer()); break; }
          catch (error) { if (attempt === 2) throw error; }
        }
        assert(bytes); storedBytes += bytes.byteLength;
        if (size === 'original') assert.equal(createHash('sha256').update(bytes).digest('hex'), photo.sha256, 'Origineel wijkt af');
        else {
          const info = await sharp(bytes).metadata(); assert.equal(info.format, 'webp');
          assert(info.width && info.width <= ({ thumb:320, grid:800, detail:1600 }[size]));
          // Decode the full image as well as its header to detect truncated/corrupt data.
          await sharp(bytes).stats();
        }
      }
      if (++verified % 40 === 0) console.log({ verified, total: photos.length });
    }
  }
  const results = await Promise.allSettled(Array.from({ length: 6 }, () => worker()));
  for (const result of results) if (result.status === 'rejected') throw result.reason;
  const report = { verifiedAt:new Date().toISOString(), existingItemsPreserved:old.items.length, items:state.items.length, newProducts:manifest.source.length, photos:verified, r2Objects:verified*4, storedBytes, sourcePhotoReferences:state.items.reduce((n,i)=>n+(i.sourcePhotos?.length||0),0), allMediaAndNumbersRegistered:true };
  await writeFile(`.data/${batch}-verification.json`, JSON.stringify(report,null,2)+'\n', { mode:0o600 });
  console.log(report);
}
main().catch(error => { console.error(error.message); process.exitCode=1; });
