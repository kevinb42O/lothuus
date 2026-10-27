import { NextRequest, NextResponse } from 'next/server';
import { objects } from '@/lib/collection';
import { catalogueProjection } from '@/lib/backend/catalogue';
import { catalogue } from '@/lib/backend/service';
import { readPhoto } from '@/lib/backend/media';

export const runtime = 'nodejs';
// Only explicitly supplied catalogue photographs may use this public route.
// Private dashboard uploads continue to require /api/images authorization.
const sourceIds = new Set(objects.flatMap(object => object.photos || [])
  .filter(photo => photo.src?.startsWith('/api/collection-images/')).map(photo => photo.id));

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const size = request.nextUrl.searchParams.get('size') || 'detail';
  if (!sourceIds.has(id) || !['thumb', 'grid', 'detail'].includes(size)) return new NextResponse(null, { status: 404 });
  try {
    // Follow current archive/publication and photo-selection rules before cache reuse.
    const visible = catalogue(await catalogueProjection()).objects.some(object => object.photos?.some(photo => photo.id === id));
    if (!visible) return new NextResponse(null, { status: 404 });
    const tag = `"source-photo-v1-${id}-${size}"`;
    const headers = { 'Content-Type': 'image/webp', 'Cache-Control': 'private, no-cache', ETag: tag, 'X-Content-Type-Options': 'nosniff' };
    const matches = (request.headers.get('if-none-match') || '').split(',').map(value => value.trim().replace(/^W\//, ''));
    if (matches.includes(tag) || matches.includes('*')) return new NextResponse(null, { status: 304, headers });
    const body = await readPhoto(id, size);
    return body ? new NextResponse(body, { headers }) : new NextResponse(null, { status: 404 });
  } catch {
    return new NextResponse(null, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
