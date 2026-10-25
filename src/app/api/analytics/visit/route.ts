import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sameOrigin } from '@/lib/backend/auth';
import { automated, deviceType } from '@/lib/analytics/device';
import { recordVisit } from '@/lib/analytics/server';
import { safeError } from '@/lib/backend/service';
export const runtime = 'nodejs';
const input = z.object({ id: z.uuid(), route: z.enum(['/', '/huis']) }).strict();
const headers = { 'Cache-Control': 'no-store' };
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return new NextResponse(null, { status: 415, headers });
    const reader = request.body?.getReader(); if (!reader) return new NextResponse(null, { status: 400, headers });
    let text = '', bytes = 0; const decoder = new TextDecoder();
    try { for (;;) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > 512) { await reader.cancel(); return new NextResponse(null, { status: 413, headers }); } text += decoder.decode(value, { stream: true }); } text += decoder.decode(); }
    finally { reader.releaseLock(); }
    let parsed; try { parsed = input.safeParse(JSON.parse(text)); } catch { return new NextResponse(null, { status: 400, headers }); }
    if (!parsed.success) return new NextResponse(null, { status: 400, headers });
    const agent = request.headers.get('user-agent') || '';
    if (!automated(agent) && !request.headers.get('purpose')?.includes('prefetch') && !request.headers.get('sec-purpose')?.includes('prefetch') && process.env.VERCEL_ENV !== 'preview') await recordVisit(parsed.data.id, deviceType(agent));
    return new NextResponse(null, { status: 204, headers });
  } catch (e) { const error = safeError(e); return NextResponse.json({ error: error.message }, { status: error.status, headers }); }
}
