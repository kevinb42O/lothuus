import { z } from 'zod';
import { cloudMode, serverDatabase, withStore } from '../backend/cloud';
import { BusinessError, catalogue, hash } from '../backend/service';
import { reservationLines } from '../backend/types';
import { type HeartObject, type HeartRaw } from './types';
import { unstable_cache } from 'next/cache';
import { catalogueProjection } from '../backend/catalogue';
import { HEARTS_TAG, invalidateReadCache } from '../backend/cache-tags';
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
  if (cloudMode()) { const result = await rpc('lothuus_heart_config', { next_enabled: enabled ?? null }); if (enabled !== undefined) invalidateReadCache(HEARTS_TAG); return result; }
  if (process.env.NODE_ENV === 'production') throw new BusinessError('Online opslag ontbreekt.', 503);
  const { localHearts } = await import('./local');
  return localHearts(s => { if (enabled !== undefined) s.enabled = enabled; return { enabled: s.enabled, startedAt: s.startedAt }; });
}
export async function recordHearts(input: unknown) {
  if (!cloudMode() && process.env.NODE_ENV === 'production') throw new BusinessError('Online opslag ontbreekt.', 503);
  const parsed = heartInput.safeParse(input); if (!parsed.success) throw new BusinessError('De hartjesaanvraag bevat ongeldige gegevens.');
  const p = parsed.data, key = hash(`lothuus-hearts:${p.browser}`);
  if (p.operation === 'forget') {
    if (cloudMode()) { await rpc('lothuus_heart_forget', { browser_key: key }); invalidateReadCache(HEARTS_TAG); }
    else { const { localHearts } = await import('./local'); localHearts(s => { delete s.browsers[key]; }); }
    return { enabled: (await heartConfig()).enabled };
  }
  if (!(await heartConfig()).enabled) return { enabled: false };
  if (p.operation === 'order') {
    if (cloudMode()) { await rpc('lothuus_heart_order', { browser_key: key, capability_hash: hash(p.token), client_sequence: p.sequence }); invalidateReadCache(HEARTS_TAG); return { enabled: true }; }
    const objects = await withStore(s => {
      const reservation=s.reservations.find(r=>r.source==='web' && r.tokenHash===hash(p.token));
      return reservation ? reservationLines(reservation).map(line=>{
        const product=s.items.find(i=>i.id===line.itemId || i.sourceReference===line.itemId);
        const id=product?.sourceReference || product?.id || line.itemId;
        return {id,title:line.title,reference:line.productNumber||id,image:line.image,category:product?.category||'objecten',source:/^[KPGTHI]\d{3}$/.test(id)?'collection':'inventory'} satisfies HeartObject;
      }) : [];
    });
    const {localHearts,orderHearts}=await import('./local');localHearts(s=>orderHearts(s,key,objects,p.sequence));
    return { enabled: true };
  }
  // An occasional activity refresh needs no product, customer or order projection.
  if (!p.actions.length) {
    if (cloudMode()) await rpc('lothuus_heart_write', { browser_key: key, actions: [] });
    else { const { localHearts, writeHearts } = await import('./local'); localHearts(s => writeHearts(s, key, [])); }
    return { enabled: true };
  }
  const known = await (async () => { const s = await catalogueProjection();
    const objects = new Map<string, HeartObject>();
    for (const o of catalogue(s).objects) {
      const product = s.items.find(i => i.id === o.id);
      const id = product?.sourceReference || o.id;
      const object: HeartObject = { id, title: o.title, image: o.image, category: o.category, reference: product?.productNumber || id, source: /^[KPGTHI]\d{3}$/.test(id) ? 'collection' : 'inventory' };
      objects.set(o.id, object); objects.set(id, object);
    }
    return { objects, aliases: new Map(s.items.map(i => [i.id, i.sourceReference || i.id])) };
  })();
  // Retired objects can be removed using their already stored snapshot. Unknown additions remain invalid.
  const actions = p.actions.flatMap(a => {
    const object = known.objects.get(a.id);
    if (object) return [{ ...a, id: object.id, object: object as HeartObject | null }];
    return a.selected ? [] : [{ ...a, id: known.aliases.get(a.id) || a.id, object: null }];
  });
  if (cloudMode()) { await rpc('lothuus_heart_write', { browser_key: key, actions }); invalidateReadCache(HEARTS_TAG); }
  else { const { localHearts, writeHearts } = await import('./local'); localHearts(s => writeHearts(s, key, actions)); }
  return { enabled: true };
}
const cachedWindow = unstable_cache(async (from: string, to: string, _database: string) => rpc('lothuus_heart_report_window', { from_day: from, to_day: to }), ['heart-window-v2'], { revalidate: 60, tags: [HEARTS_TAG] });
export async function rawHearts(from = '1970-01-01', to = '9999-12-31'): Promise<HeartRaw> {
  if (cloudMode()) return process.env.NODE_ENV === 'production' ? cachedWindow(from, to, process.env.SUPABASE_URL || '') : rpc('lothuus_heart_report_window', { from_day: from, to_day: to });
  if (process.env.NODE_ENV === 'production') throw new BusinessError('Online opslag ontbreekt.', 503);
  const { localHearts } = await import('./local');
  return localHearts(s => {
    const recent = new Map<string, { id: string; count: number; lastSeen: string }>();
    for (const b of Object.values(s.browsers)) for (const [id, state] of Object.entries(b.states)) if (state.selected) { const row = recent.get(id) || { id, count: 0, lastSeen: b.seenAt }; row.count++; if (b.seenAt > row.lastSeen) row.lastSeen = b.seenAt; recent.set(id, row); }
    return { enabled: s.enabled, startedAt: s.startedAt, objects: s.objects, days: s.days, recent: [...recent.values()] };
  });
}
