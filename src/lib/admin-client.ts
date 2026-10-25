import type { AdminStore } from './backend/types';

let storeCache: AdminStore | undefined;
let storeTag: string | undefined;
let generation = 0;

export const storeGeneration = () => generation;
export function invalidateStoreCache() { generation++; storeCache = undefined; storeTag = undefined; }

export async function adminApi(path: string, body?: unknown, method?: string) {
  const verb = method || (body ? 'POST' : 'GET');
  if ((path === '/api/store' || path === '/api/session') && verb !== 'GET') invalidateStoreCache();
  const started = generation, cached = storeCache;
  const headers: Record<string, string> = body ? { 'Content-Type': 'application/json' } : {};
  if (path === '/api/store' && verb === 'GET' && storeTag && cached) headers['If-None-Match'] = storeTag;
  const response = await fetch(path, { method: verb, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (response.status === 304 && cached) return cached;
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && generation === started) { storeCache = undefined; storeTag = undefined; }
    throw new Error(result.error || 'De verbinding is onderbroken. Probeer opnieuw.');
  }
  // A read started before a save or login must never replace the newer cache.
  if (path === '/api/store' && generation === started) { storeCache = result; storeTag = response.headers.get('etag') || undefined; }
  return result;
}
