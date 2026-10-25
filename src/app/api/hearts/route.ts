import { NextRequest, NextResponse } from 'next/server';
import { isOwner, readJson, sameOrigin, throttle } from '@/lib/backend/auth';
import { safeError } from '@/lib/backend/service';
import { heartConfig, recordHearts } from '@/lib/hearts/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET() {
  try { const { enabled } = await heartConfig(); return NextResponse.json({ enabled }, { headers }); }
  catch (e) { const error = safeError(e); return NextResponse.json({ error: error.message }, { status: error.status, headers }); }
}
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request); const input = await readJson(request);
    // The owner can inspect the public site without influencing its statistics.
    if (input.operation !== 'forget' && await isOwner(request)) return NextResponse.json({ ok: true, excluded: true }, { headers });
    await throttle(request, 'heart-sync', 600); const result = await recordHearts(input);
    return NextResponse.json({ ok: true, ...result }, { headers });
  } catch (e) { const error = safeError(e); return NextResponse.json({ error: error.message }, { status: error.status, headers }); }
}
