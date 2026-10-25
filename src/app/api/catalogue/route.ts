import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { publicCatalogue } from '@/lib/backend/catalogue';
import { safeError } from '@/lib/backend/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const body = JSON.stringify(await publicCatalogue());
    const tag = `"${createHash('sha256').update(body).digest('base64url')}"`;
    const headers = { 'Cache-Control': 'public, max-age=0, must-revalidate', ETag: tag };
    const matches = (request.headers.get('if-none-match') || '').split(',').map(value => value.trim().replace(/^W\//, ''));
    if (matches.includes(tag) || matches.includes('*')) return new NextResponse(null, { status: 304, headers });
    return new NextResponse(body, { headers: { ...headers, 'Content-Type': 'application/json' } });
  } catch (e) { const error = safeError(e); return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store' } }); }
}
