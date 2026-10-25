import { DatabaseSync } from 'node:sqlite';
import { existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
const directory = resolve(process.env.LOTHUUS_DATA_DIR || '.data');
const db = new DatabaseSync(join(directory, 'lothuus.sqlite'));
try {
  // Prevent a product save from attaching an old upload after we read its references.
  db.exec('PRAGMA busy_timeout=5000; BEGIN IMMEDIATE;');
  const row = db.prepare('SELECT body FROM app_state WHERE id=1').get();
  if (!row || !existsSync(join(directory, 'images'))) { console.log('Geen afbeeldingen om op te ruimen.'); process.exit(0); }
  const s = JSON.parse(row.body);
  const used = new Set(s.items.flatMap(i => [...i.photos, ...(i.sourcePhotos || [])].map(p => p.id)));
  // Reservation snapshots can still reference removed photos.
  const retainImage = image => { const id = image?.match(/\/api\/images\/([a-f0-9-]{36})(?:[?]|$)/)?.[1]; if (id) used.add(id); };
  for (const r of s.reservations) { retainImage(r.image); for (const line of r.lines || []) retainImage(line.image); }
  if (existsSync(join(directory, 'hearts.sqlite'))) {
    const hearts = new DatabaseSync(join(directory, 'hearts.sqlite'), { readOnly: true });
    try { const row = hearts.prepare('SELECT body FROM hearts WHERE id=1').get(); if (row) for (const object of JSON.parse(row.body).objects) retainImage(object.image); }
    finally { hearts.close(); }
  }
  let count = 0;
  for (const file of readdirSync(join(directory, 'images'))) {
    const id = file.match(/^([a-f0-9-]{36})-(thumb|grid|detail)\.webp$/)?.[1];
    const path = join(directory, 'images', file);
    if (id && !used.has(id) && statSync(path).mtimeMs < Date.now() - 7 * 86400000) { unlinkSync(path); count++; }
  }
  db.exec('COMMIT');
  console.log(`${count} ongebruikte afbeeldingsbestanden ouder dan zeven dagen opgeruimd.`);
} finally { db.close(); }
