import { createClient } from '@supabase/supabase-js';
import { expireOrders, type Store } from './types';
import { BusinessError } from './service';
import { OBJECT_LIMIT_MESSAGE } from '../hosting/capacity';
import { CATALOGUE_TAG, HEARTS_TAG, invalidateReadCache } from './cache-tags';
export const cloudMode = () => process.env.BACKEND_MODE === 'supabase';
export function serverDatabase() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new BusinessError('De online opslag is niet geconfigureerd.', 503);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store', signal: AbortSignal.timeout(15000) }) } });
}
/** Callback must be pure: a concurrent writer can cause a retry. No emails or uploads here. */
export async function withStore<T>(operation: (state: Store) => T, onRevision?: (revision: number) => void, actor?: string, operatorChange?: {kind:'product_restored'|'product_status_changed';itemId:string;reason:string;sourceVersion?:string}): Promise<T> {
  if (!cloudMode()) {
    if (process.env.NODE_ENV === 'production') throw new BusinessError('Online opslag ontbreekt.', 503);
    const { transact } = await import('./repository');
    return transact(operation);
  }
  const db = serverDatabase();
  for (let attempt = 0; attempt < 8; attempt++) {
    const loaded = await db.rpc('lothuus_load_state');
    if (loaded.error || !loaded.data?.state) throw new BusinessError('De opslag is tijdelijk niet bereikbaar. Probeer opnieuw.', 503);
    const state = loaded.data.state as Store, before = JSON.stringify(state);
    expireOrders(state);
    const previousCount = state.items.length;
    const result = operation(state);
    if (JSON.stringify(state) === before) { onRevision?.(loaded.data.revision); return result; }
    // Recheck on every revision retry. The compare-and-swap commit serializes
    // competing creates, including stale forms and requests bypassing the UI.
    if (state.items.length > previousCount) {
      const capacity = await db.rpc('lothuus_capacity_policy');
      if (capacity.error || !Number.isSafeInteger(capacity.data?.limit) || capacity.data.limit <= 0) throw new BusinessError('Je pakketlimiet kan nu niet worden gecontroleerd. Je invoer blijft behouden. Probeer opnieuw.', 503);
      if (typeof capacity.data.enforced !== 'boolean') throw new BusinessError('Je pakketlimiet kan nu niet worden gecontroleerd.', 503);
      if (capacity.data.enforced && state.items.length > capacity.data.limit) {
        const { recordActivity } = await import('../superadmin/server');
        await recordActivity(actor, 'capacity_denied');
        throw new BusinessError(OBJECT_LIMIT_MESSAGE, 409);
      }
    }
    const saved = await db.rpc(operatorChange ? 'lothuus_operator_commit' : actor ? 'lothuus_commit_state_audited' : 'lothuus_commit_state', { expected_revision: loaded.data.revision, next_state: state, ...(actor ? { actor } : {}), ...(operatorChange ? {item_key:operatorChange.itemId,event_kind:operatorChange.kind,reason:operatorChange.reason,source_version:operatorChange.sourceVersion || null} : {}) });
    if (saved.error?.message.includes('HOSTING_OBJECT_LIMIT')) {
      const { recordActivity } = await import('../superadmin/server');
      await recordActivity(actor, 'capacity_denied');
      throw new BusinessError(OBJECT_LIMIT_MESSAGE, 409);
    }
    if (saved.error?.message.includes('OPERATOR_VERSION_NOT_FOUND')) throw new BusinessError('De herstelversie is niet meer beschikbaar. Vernieuw de fiche.',404);
    if (saved.error?.message.includes('OPERATOR_FORBIDDEN')) throw new BusinessError('Je beheertoegang is ingetrokken.',403);
    if (saved.error) throw new BusinessError('Opslaan is niet gelukt. Vernieuw de gegevens en probeer opnieuw.', 503);
    if (saved.data === true) { invalidateReadCache(CATALOGUE_TAG, HEARTS_TAG); onRevision?.(loaded.data.revision + 1); return result; }
  }
  throw new BusinessError('Er wordt tegelijk gewerkt. Probeer opnieuw.', 409);
}
