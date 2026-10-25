import { NextRequest, NextResponse } from 'next/server';
import { readJson, requireOwner, sameOrigin } from '@/lib/backend/auth';
import { withStore } from '@/lib/backend/cloud';
import { BusinessError, safeError } from '@/lib/backend/service';
import { heartConfig, rawHearts } from '@/lib/hearts/server';
import { buildHeartReport } from '@/lib/hearts/report';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: NextRequest) {
  try { await requireOwner(request); const raw = await rawHearts(); const report = await withStore(s => buildHeartReport(raw,s,request.nextUrl.searchParams)); return NextResponse.json(report,{headers}); }
  catch(e) { const error = safeError(e); return NextResponse.json({error:error.message},{status:error.status,headers}); }
}
export async function POST(request: NextRequest) {
  try { sameOrigin(request); await requireOwner(request); const input = await readJson(request); if (typeof input.enabled !== 'boolean') throw new BusinessError('Kies of de meting aan of uit staat.'); return NextResponse.json(await heartConfig(input.enabled),{headers}); }
  catch(e) { const error = safeError(e); return NextResponse.json({error:error.message},{status:error.status,headers}); }
}
