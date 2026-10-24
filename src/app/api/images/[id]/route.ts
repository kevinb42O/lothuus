import { NextRequest, NextResponse } from 'next/server';
import { readPhoto } from '@/lib/backend/media';
import { isOwner } from '@/lib/backend/auth';
import { cloudMode, serverDatabase, withStore } from '@/lib/backend/cloud';
export const runtime = 'nodejs';
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params; const size = request.nextUrl.searchParams.get('size') || 'detail';
  if (!/^[a-f0-9-]{36}$/.test(id) || !['thumb', 'grid', 'detail'].includes(size)) return new NextResponse(null, { status: 404 });
  const owner = await isOwner(request);
  if (!owner) {
    const published = cloudMode() ? (await serverDatabase().rpc('lothuus_photo_is_public', { photo_id: id })).data === true : await withStore(s => s.items.some(i => i.publication === 'published' && i.photos.some(p => p.id === id)));
    if (!published) return new NextResponse(null, { status: 404 });
  }
  try { const body = await readPhoto(id, size); if (!body) return new NextResponse(null, { status: 404 }); return new NextResponse(body, { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } }); }
  catch { return new NextResponse(null, { status: 404 }); }
}
