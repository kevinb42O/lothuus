import { createClient } from '@supabase/supabase-js';
import { expireOrders, type Store } from './types';
import { BusinessError } from './service';
import { CATALOGUE_TAG, HEARTS_TAG, invalidateReadCache } from './cache-tags';
export const cloudMode = () => process.env.BACKEND_MODE === 'supabase';
export function serverDatabase() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new BusinessError('De online opslag is niet geconfigureerd.', 503);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store', signal: AbortSignal.timeout(15000) }) } });
}
/** Callback must be pure: a concurrent writer can cause a retry. No emails or uploads here. */
export async function withStore<T>(operation: (state: Store) => T, onRevision?: (revision: number) => void): Promise<T> {
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
    const result = operation(state);
    if (JSON.stringify(state) === before) { onRevision?.(loaded.data.revision); return result; }
    const saved = await db.rpc('lothuus_commit_state', { expected_revision: loaded.data.revision, next_state: state });
    if (saved.error) throw new BusinessError('Opslaan is niet gelukt. Vernieuw de gegevens en probeer opnieuw.', 503);
    if (saved.data === true) { invalidateReadCache(CATALOGUE_TAG, HEARTS_TAG); onRevision?.(loaded.data.revision + 1); return result; }
  }
  throw new BusinessError('Er wordt tegelijk gewerkt. Probeer opnieuw.', 409);
}
