import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { dataDirectory } from '../backend/repository';
import { localDay } from './time';
import type { AnalyticsRaw, Device } from './types';

export function localAnalytics<T>(operation: (db: DatabaseSync) => T) {
  mkdirSync(dataDirectory(), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(join(dataDirectory(), 'analytics.sqlite'));
  try {
    db.exec(`PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS config (id INTEGER PRIMARY KEY, enabled INTEGER NOT NULL, started TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS visits (id TEXT PRIMARY KEY, at TEXT NOT NULL, device TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS visits_at ON visits(at);
      CREATE TABLE IF NOT EXISTS days (day TEXT NOT NULL, device TEXT NOT NULL, visits INTEGER NOT NULL, PRIMARY KEY(day,device));
      CREATE TABLE IF NOT EXISTS limits (minute INTEGER PRIMARY KEY, hits INTEGER NOT NULL);
      BEGIN IMMEDIATE;`);
    db.prepare('INSERT OR IGNORE INTO config VALUES (1,1,?)').run(new Date().toISOString());
    db.prepare('DELETE FROM visits WHERE at < ?').run(new Date(Date.now() - 48 * 3600000).toISOString());
    db.prepare('DELETE FROM limits WHERE minute < ?').run(Math.floor(Date.now() / 60000) - 2);
    const result = operation(db); db.exec('COMMIT'); return result;
  } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; } finally { db.close(); }
}
export function localVisit(id: string, device: Device, timestamp?: number) {
  return localAnalytics(db => {
    if (!(db.prepare('SELECT enabled FROM config WHERE id=1').get() as { enabled: number }).enabled) return;
    const acceptedAt = timestamp ?? Date.now();
    const minute = Math.floor(acceptedAt / 60000);
    db.prepare('INSERT INTO limits VALUES (?,1) ON CONFLICT(minute) DO UPDATE SET hits=hits+1').run(minute);
    if ((db.prepare('SELECT hits FROM limits WHERE minute=?').get(minute) as { hits: number }).hits > 2000) return;
    const inserted = db.prepare('INSERT OR IGNORE INTO visits VALUES (?,?,?)').run(id, new Date(acceptedAt).toISOString(), device);
    if (inserted.changes) db.prepare('INSERT INTO days VALUES (?,?,1) ON CONFLICT(day,device) DO UPDATE SET visits=visits+1').run(localDay(acceptedAt), device);
  });
}
export function localRaw(): AnalyticsRaw {
  return localAnalytics(db => {
    const config = db.prepare('SELECT * FROM config WHERE id=1').get() as { enabled: number; started: string };
    return { enabled: !!config.enabled, startedAt: config.started, now: new Date().toISOString(),
      days: db.prepare('SELECT * FROM days ORDER BY day').all() as AnalyticsRaw['days'], events: db.prepare('SELECT * FROM visits ORDER BY at').all() as AnalyticsRaw['events'] };
  });
}
