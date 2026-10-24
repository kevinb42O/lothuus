import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expireOrders, type Store } from './types';
export const dataDirectory = () => resolve(/* turbopackIgnore: true */ process.env.LOTHUUS_DATA_DIR || '.data');
export function initialStore(): Store {
  return { schemaVersion: 1, items: [], customers: [], reservations: [], emails: [], requests: {}, limits: {}, settingsVersion: 1, settings: { businessName: 'LOTHUUS', ownerEmail: '', replyTo: '', beneficiary: '', iban: '', deadlineDays: 3, pickup: 'Ophalen op afspraak. Neem contact op om een moment af te spreken.', terms: '', privacy: '', termsVersion: '1', reservationsEnabled: false } };
}
// Isolated development/test adapter. Online HTTP routes use cloud.ts instead.
// SQLite's write lock serializes tests across processes.
export function transact<T>(operation: (state: Store) => T): T {
  mkdirSync(dataDirectory(), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(resolve(dataDirectory(), 'lothuus.sqlite'));
  try {
    db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK (id=1), body TEXT NOT NULL); BEGIN IMMEDIATE;');
    const row = db.prepare('SELECT body FROM app_state WHERE id=1').get() as { body: string } | undefined;
    const state: Store = row ? JSON.parse(row.body) : initialStore();
    if (state.schemaVersion !== 1) throw new Error('Onbekende databaseversie.');
    expireOrders(state);
    const result = operation(state);
    for (const item of state.items) for (const photo of item.photos) if (!existsSync(resolve(dataDirectory(), 'images', `${photo.id}-detail.webp`))) throw new Error('Een foto is niet volledig opgeslagen. Upload deze opnieuw.');
    db.prepare('INSERT INTO app_state(id,body) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body').run(JSON.stringify(state));
    db.exec('COMMIT');
    return result;
  } catch (error) { try { db.exec('ROLLBACK'); } catch { /* Transaction did not start. */ } throw error; }
  finally { db.close(); }
}
