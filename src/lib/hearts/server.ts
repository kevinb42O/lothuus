import { z } from 'zod';
import { cloudMode, serverDatabase, withStore } from '../backend/cloud';
import { BusinessError, catalogue, hash } from '../backend/service';
import { reservationLines } from '../backend/types';
import { heartDay, type HeartObject, type HeartRaw } from './types';
const actionSchema = z.object({ id: z.string().min(1).max(128), selected: z.boolean(), sequence: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), baseline: z.boolean().optional() });
export const heartInput = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('sync'), browser: z.uuid(), actions: z.array(actionSchema).max(100) }),
  z.object({ operation: z.literal('forget'), browser: z.uuid() }),
  z.object({ operation: z.literal('order'), browser: z.uuid(), token: z.string().regex(/^[a-f0-9]{64}$/), sequence: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) }),
]);
async function rpc(name: string, args?: Record<string, unknown>) {
  const { data, error } = await serverDatabase().rpc(name, args);
  if (error) throw new BusinessError('De hartjesgegevens zijn tijdelijk niet bereikbaar. Probeer opnieuw.', 503);
  return data;
}
export async function heartConfig(enabled?: boolean): Promise<{ enabled: boolean; startedAt: string }> {
  if (cloudMode()) return rpc('lothuus_heart_config', { next_enabled: enabled ?? null });
  if (process.env.NODE_ENV === 'production') throw new BusinessError('Online opslag ontbreekt.', 503);
  const { localHearts } = await import('./local');
  return localHearts(s => { if (enabled !== undefined) s.enabled = enabled; return { enabled: s.enabled, startedAt: s.startedAt }; });
}
export async function recordHearts(input: unknown) {
  if (!cloudMode() && process.env.NODE_ENV === 'production') throw new BusinessError('Online opslag ontbreekt.', 503);
  const parsed = heartInput.safeParse(input); if (!parsed.success) throw new BusinessError('De hartjesaanvraag bevat ongeldige gegevens.');
  const p = parsed.data, key = hash(`lothuus-hearts:${p.browser}`);
  if (p.operation === 'forget') {
    if (cloudMode()) await rpc('lothuus_heart_forget', { browser_key: key });
    else { const { localHearts } = await import('./local'); localHearts(s => { delete s.browsers[key]; }); }
    return;
  }
  if (!(await heartConfig()).enabled) return;
  if (p.operation === 'order') {
    if (cloudMode()) { await rpc('lothuus_heart_order', { browser_key: key, capability_hash: hash(p.token), client_sequence: p.sequence }); return; }
    const lines = await withStore(s => { const r = s.reservations.find(r => r.source === 'web' && r.tokenHash === hash(p.token)); return r ? reservationLines(r).map(line => ({ ...line, itemId: s.items.find(i => i.id === line.itemId)?.sourceReference || line.itemId })) : []; });
    const { localHearts } = await import('./local');
    localHearts(s => { const b = s.browsers[key]; if (!b) return; for (const line of lines) { const old = b.states[line.itemId]; if (!old?.selected || old.sequence >= p.sequence) continue; old.selected = false; old.sequence = p.sequence; let day = s.days.find(d => d.id === line.itemId && d.day === heartDay(Date.now())); if (!day) { day = { day: heartDay(Date.now()), id: line.itemId, added: 0, removed: 0, ordered: 0 }; s.days.push(day); } day.ordered++; } });
    return;
  }
  const known = await withStore(s => {
    const objects = new Map<string, HeartObject>();
    for (const o of catalogue(s).objects) {
      const product = s.items.find(i => i.id === o.id);
      const id = product?.sourceReference || o.id;
      const object: HeartObject = { id, title: o.title, image: o.image, category: o.category, reference: product?.productNumber || id, source: /^[KGH]\d{3}$/.test(id) ? 'collection' : 'inventory' };
      objects.set(o.id, object); objects.set(id, object);
    }
    return objects;
  });
  // Removed/archived/unknown objects cannot inject arbitrary historical records.
  const actions = p.actions.flatMap(a => { const object = known.get(a.id); return object ? [{ ...a, id: object.id, object }] : []; });
  if (cloudMode()) await rpc('lothuus_heart_write', { browser_key: key, actions });
  else { const { localHearts, writeHearts } = await import('./local'); localHearts(s => writeHearts(s, key, actions)); }
}
export async function rawHearts(): Promise<HeartRaw> {
  if (cloudMode()) return rpc('lothuus_heart_report');
  if (process.env.NODE_ENV === 'production') throw new BusinessError('Online opslag ontbreekt.', 503);
  const { localHearts } = await import('./local');
  return localHearts(s => {
    const recent = new Map<string, { id: string; count: number; lastSeen: string }>();
    for (const b of Object.values(s.browsers)) for (const [id, state] of Object.entries(b.states)) if (state.selected) { const row = recent.get(id) || { id, count: 0, lastSeen: b.seenAt }; row.count++; if (b.seenAt > row.lastSeen) row.lastSeen = b.seenAt; recent.set(id, row); }
    return { enabled: s.enabled, startedAt: s.startedAt, objects: s.objects, days: s.days, recent: [...recent.values()] };
  });
}
