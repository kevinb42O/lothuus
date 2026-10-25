import { createHash } from 'node:crypto';
import type { Store } from '../backend/types';

export const backupTables = ['store','media','product_numbers','stock_claims','heart_settings','heart_objects','heart_days','analytics_config','analytics_days','hosting_account','hosting_orders','hosting_entitlements','hosting_media_objects','hosting_metrics','hosting_usage_daily'] as const;
type Row = Record<string, unknown>;
export type CloudBackup = { schemaVersion: 2; createdAt: string; tables: Record<typeof backupTables[number], Row[]> };
export const checksum = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export function validateBackup(value: unknown): CloudBackup {
  const b = value as CloudBackup;
  if (b?.schemaVersion !== 2 || !Number.isFinite(Date.parse(b.createdAt)) || !b.tables || Object.keys(b.tables).length !== backupTables.length || !backupTables.every(t => Array.isArray(b.tables[t]))) throw new Error('Incomplete backup schema');
  const state = b.tables.store[0]?.body as Store;
  if (b.tables.store.length !== 1 || state?.schemaVersion !== 1 || !Array.isArray(state.items) || !Array.isArray(state.reservations)) throw new Error('Invalid store backup');
  const media = new Set(b.tables.media.map(r => r.id));
  const numbers = new Map(b.tables.product_numbers.map(r => [r.number, r.item_id]));
  if (new Set(state.items.map(i => i.id)).size !== state.items.length) throw new Error('Duplicate item identifiers');
  for (const item of state.items) {
    for (const photo of [...item.photos, ...(item.sourcePhotos || [])]) if (!media.has(photo.id)) throw new Error('Backup has missing media references');
    for (const number of [item.productNumber,...(item.previousNumbers || [])].filter(Boolean)) if (numbers.get(number) !== item.id) throw new Error('Backup has missing product numbers');
  }
  const orders = new Map(b.tables.hosting_orders.map(r => [r.id, r]));
  for (const r of b.tables.hosting_entitlements) if (orders.get(r.order_id)?.status !== 'active') throw new Error('Backup has an entitlement without an active order');
  if (b.tables.hosting_account.length !== 1 || b.tables.analytics_config.length !== 1 || b.tables.heart_settings.length !== 1) throw new Error('Backup has missing account or measurement settings');
  for (const row of b.tables.analytics_days) if (!Number.isSafeInteger(row.visits) || Number(row.visits) < 0) throw new Error('Invalid analytics totals');
  return b;
}
