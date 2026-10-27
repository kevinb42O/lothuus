import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type { Category } from '../../src/lib/collection';
import { command } from '../../src/lib/backend/service';
import type { Store, Photo } from '../../src/lib/backend/types';
import assert from 'node:assert/strict';
import type { MaterialGroup } from '../../src/lib/inventory';

export const batch = 'collection-2026-10-26';
export const sourceDirectory = 'wetransfer_inox-ijzer_2026-10-26_2014';
const groups: { folder: string; category: Category; label: string; prefix: MaterialGroup }[] = [
  { folder: 'inox, ijzer,...', category: 'inox-ijzer', label: 'Inox / ijzer', prefix: 'I' },
  { folder: 'plastic', category: 'plastiek', label: 'Plastiek', prefix: 'P' },
  { folder: 'textiel', category: 'textiel', label: 'Textiel', prefix: 'T' },
];
export const naturalOrder = (a: string, b: string) => a.localeCompare(b, 'nl', { numeric: true });
export type SourcePhoto = { path: string; sha256: string; bytes: number; width: number; height: number; alt: string };
export type SourceRecord = { reference: string; folder: string; category: Category; label: string; prefix: MaterialGroup; photos: SourcePhoto[]; omitted: string[] };
export function creationKey(reference: string) {
  // Same deterministic UUID convention as the first import, with a distinct batch namespace.
  const key = createHash('sha256').update(`lothuus-source:${batch}:${reference}`).digest('hex').slice(0, 32);
  return `${key.slice(0,8)}-${key.slice(8,12)}-4${key.slice(13,16)}-a${key.slice(17,20)}-${key.slice(20)}`;
}
export async function scanSource(root: string): Promise<SourceRecord[]> {
  const records: SourceRecord[] = [];
  for (const group of groups) {
    const base = join(root, group.folder);
    const folders = (await readdir(base, { withFileTypes: true })).filter(f => f.isDirectory()).map(f => f.name).sort(naturalOrder);
    for (const [index, folder] of folders.entries()) {
      const reference = `${group.prefix}${String(index + 1).padStart(3, '0')}`;
      const files = (await readdir(join(base, folder))).filter(f => /\.(jpe?g|png|webp)$/i.test(f)).sort(naturalOrder);
      if (!files.length) throw new Error(`Lege productmap: ${folder}`);
      const photos: SourcePhoto[] = [];
      for (const [index, name] of files.slice(0, 8).entries()) {
        const path = join(group.folder, folder, name), bytes = await readFile(join(root, path));
        const info = await sharp(bytes, { limitInputPixels: 40000000 }).metadata();
        if (!info.width || !info.height || bytes.length > 4000000) throw new Error(`Ongeldige foto: ${path}`);
        photos.push({ path, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, width: info.width, height: info.height, alt: `${group.label} ${reference}, foto ${index + 1}` });
      }
      records.push({ reference, folder: join(group.folder, folder), category: group.category, label: group.label, prefix: group.prefix, photos, omitted: files.slice(8) });
    }
  }
  return records;
}

export function importRecord(state: Store, record: SourceRecord, photos: Photo[]) {
  assert(photos.length >= 1 && photos.length <= 8, 'Import gebruikt maximaal acht foto’s');
  const key = creationKey(record.reference);
  const previous = state.items.find(i => i.creationKey === key);
  if (previous) { assert.equal(previous.sourceReference, record.reference, 'Importidentiteit wijkt af'); return previous; }
  assert(!state.items.some(i => i.sourceReference === record.reference), 'Bronreferentie bestaat al buiten deze batch');
  command(state, { action: 'save-item', item: { creationKey: key, materialGroup: record.prefix, title: `${record.label} · ${record.reference}`, category: record.category, description: '', priceCents: 0, priceUnset: true, date: '', material: record.label, dimensions: '', maker: '', condition: '', publication: 'draft', editorReady: false, photos } });
  const created = state.items.find(i => i.creationKey === key)!;
  created.sourceReference = record.reference; created.sourcePhotoCount = photos.length; created.sourcePhotos = photos;
  return created;
}
