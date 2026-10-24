import { DatabaseSync } from 'node:sqlite';
import { existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
const directory = resolve(process.env.LOTHUUS_DATA_DIR || '.data');
const db = new DatabaseSync(join(directory, 'lothuus.sqlite'));
try {
  const row = db.prepare('SELECT body FROM app_state WHERE id=1').get();
  if (!row || !existsSync(join(directory, 'images'))) { console.log('Geen afbeeldingen om op te ruimen.'); process.exit(0); }
  const s = JSON.parse(row.body);
  const used = new Set(s.items.flatMap(i => i.photos.map(p => p.id)));
  // Reservation snapshots can still reference removed photos.
  for (const r of s.reservations) { const id = r.image.match(/images\/([a-f0-9-]+)/)?.[1]; if (id) used.add(id); }
  let count = 0;
  for (const file of readdirSync(join(directory, 'images'))) {
    const id = file.match(/^([a-f0-9-]{36})-(thumb|grid|detail)\.webp$/)?.[1];
    const path = join(directory, 'images', file);
    if (id && !used.has(id) && statSync(path).mtimeMs < Date.now() - 7 * 86400000) { unlinkSync(path); count++; }
  }
  console.log(`${count} ongebruikte afbeeldingsbestanden ouder dan zeven dagen opgeruimd.`);
} finally { db.close(); }
