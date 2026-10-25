import { NextRequest, NextResponse } from 'next/server';
import { readJson, requireOwner, sameOrigin } from '@/lib/backend/auth';
import { withStore } from '@/lib/backend/cloud';
import { BusinessError, safeError } from '@/lib/backend/service';
import { heartConfig, rawHearts } from '@/lib/hearts/server';
import { hostingReport } from '@/lib/hosting/server';
import { hasExtendedAnalytics } from '@/lib/hosting/access';
import { heartDay, shiftDay } from '@/lib/hearts/types';
import { buildHeartReport } from '@/lib/hearts/report';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: NextRequest) {
  try {
    await requireOwner(request);
    const hosting = await hostingReport(), extended = hasExtendedAnalytics(hosting.plan);
    const params = new URLSearchParams(request.nextUrl.searchParams);
    if (!params.has('period')) params.set('period', '7');
    if (!extended && params.get('period') !== '7') throw new BusinessError('Uitgebreide analytics zijn beschikbaar vanaf Pro.', 403);
    const raw = await rawHearts();
    if (!extended) raw.days = raw.days.filter(day => day.day >= shiftDay(heartDay(Date.now()), -6));
    const report = await withStore(s => buildHeartReport(raw,s,params));
    if (!extended) { report.comparable = false; report.previousAdded = 0; }
    return NextResponse.json({ ...report, plan: hosting.plan },{headers});
  }
  catch(e) { const error = safeError(e); return NextResponse.json({error:error.message},{status:error.status,headers}); }
}
export async function POST(request: NextRequest) {
  try { sameOrigin(request); await requireOwner(request); const input = await readJson(request); if (typeof input.enabled !== 'boolean') throw new BusinessError('Kies of de meting aan of uit staat.'); return NextResponse.json(await heartConfig(input.enabled),{headers}); }
  catch(e) { const error = safeError(e); return NextResponse.json({error:error.message},{status:error.status,headers}); }
}
