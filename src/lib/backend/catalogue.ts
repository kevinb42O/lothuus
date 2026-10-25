import { unstable_cache } from 'next/cache';
import { cloudMode, serverDatabase, withStore } from './cloud';
import { BusinessError, catalogue } from './service';
import type { Store } from './types';
import { CATALOGUE_TAG } from './cache-tags';
async function loadProjection(_database: string): Promise<Store> {
  const { data, error } = await serverDatabase().rpc('lothuus_catalogue_projection');
  if (error || !data) throw new BusinessError('De collectie is tijdelijk niet bereikbaar.', 503);
  return data as Store;
}
// This app uses the supported Data Cache without enabling Cache Components.
const cachedProjection = unstable_cache(loadProjection, ['catalogue-projection-v2'], { revalidate: 60, tags: [CATALOGUE_TAG] });
export async function catalogueProjection() {
  if (!cloudMode()) return withStore(state => state);
  return process.env.NODE_ENV === 'production' ? cachedProjection(process.env.SUPABASE_URL || '') : loadProjection(process.env.SUPABASE_URL || '');
}
export async function publicCatalogue() { return catalogue(await catalogueProjection()); }
