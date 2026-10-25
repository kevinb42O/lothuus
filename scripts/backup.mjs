import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, existsSync, cpSync, writeFileSync, readdirSync, chmodSync } from 'node:fs';
import { resolve, join } from 'node:path';
const source = resolve(process.env.LOTHUUS_DATA_DIR || '.data');
if (!existsSync(join(source, 'lothuus.sqlite'))) throw new Error('Geen database gevonden. Open eerst de website.');
const destination = resolve(process.argv[2] || `.backups/${new Date().toISOString().replaceAll(':', '-')}`);
if (existsSync(destination)) throw new Error('Bestemming bestaat al; kies een nieuwe map.');
mkdirSync(destination, { recursive: true, mode: 0o700 });
for (const name of readdirSync(source).filter(name => name.endsWith('.sqlite'))) {
  const db = new DatabaseSync(join(source, name), { readOnly: true });
  try { await backup(db, join(destination, name)); chmodSync(join(destination, name), 0o600); }
  finally { db.close(); }
}
for (const name of ['images', 'owner.json', 'session-key']) if (existsSync(join(source, name))) cpSync(join(source, name), join(destination, name), { recursive: true });
writeFileSync(join(destination, 'README.txt'), 'LOTHUUS lokale backup, inclusief alle lokale databases. Stop de app voordat je herstelt. Kopieer de inhoud naar LOTHUUS_DATA_DIR. Bewaar deze map versleuteld: ze bevat klantgegevens en toegangssleutels.\n', { mode: 0o600 });
console.log(`Backup opgeslagen in ${destination}`);
