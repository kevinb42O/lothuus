import { NextResponse } from 'next/server';
import { withStore } from '@/lib/backend/cloud';
import { catalogue, safeError } from '@/lib/backend/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return NextResponse.json(await withStore(catalogue), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (e) { const error = safeError(e); return NextResponse.json({ error: error.message }, { status: error.status }); }
}
