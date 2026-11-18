import type { CollectionObject } from './collection';
import type { PublicSettings } from './backend/types';

type CatalogueData = { objects: CollectionObject[]; hasInventory: boolean; settings: PublicSettings };

/** Allow a slow body download and retry transient failures without a tab switch. */
export async function requestCatalogue(tag?: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch('/api/catalogue', {
        cache: 'no-store', headers: tag ? { 'If-None-Match': tag } : {},
        signal: AbortSignal.timeout(120_000),
      });
      if (response.status === 304) return { data: null, tag };
      if (!response.ok) throw new Error('Catalogue unavailable');
      // Reading the body belongs inside the retry: headers can arrive long before JSON.
      const data = await response.json() as CatalogueData;
      return { data, tag: response.headers.get('etag') || undefined };
    } catch (error) {
      if (attempt >= 2) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 3000 : 10_000));
    }
  }
}
