import { revalidateTag } from 'next/cache';
export const CATALOGUE_TAG = 'lothuus-public-catalogue-v2';
export const HEARTS_TAG = 'lothuus-heart-reports-v2';
export function invalidateReadCache(...tags: string[]) {
  for (const tag of tags) {
    try { revalidateTag(tag, { expire: 0 }); }
    catch { /* CLI writes have no Next request context; the shared cache expires within 60 seconds. */ }
  }
}
