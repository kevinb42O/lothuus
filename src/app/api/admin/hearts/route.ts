import { NextRequest, NextResponse } from 'next/server';
import { readJson, requireOwner, sameOrigin } from '@/lib/backend/auth';
import { catalogueProjection } from '@/lib/backend/catalogue';
import { BusinessError, safeError } from '@/lib/backend/service';
import { heartConfig, rawHearts } from '@/lib/hearts/server';
import { hostingReport } from '@/lib/hosting/server';
import { hasExtendedAnalytics } from '@/lib/hosting/access';
import { heartDay, shiftDay, monthsBefore } from '@/lib/hearts/types';
import { buildHeartReport } from '@/lib/hearts/report';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: NextRequest) {
  try {
    await requireOwner(request);
    const params = new URLSearchParams(request.nextUrl.searchParams);
    if (!params.has('period')) params.set('period', '7');
    const period = params.get('period')!;
    if (!['7', '30', '90', 'all'].includes(period)) throw new BusinessError('Kies een geldige periode.', 403);
    const today = heartDay(Date.now());
    const from = period === 'all' ? monthsBefore(today, 24) : shiftDay(today, -2 * (Number(period) - 1));
    const raw = await rawHearts(from, today);
    const plan = raw.plan || (await hostingReport()).plan, extended = hasExtendedAnalytics(plan);
    if (!extended && params.get('period') !== '7') throw new BusinessError('Uitgebreide analytics zijn beschikbaar vanaf Pro.', 403);
    if (!extended) raw.days = raw.days.filter(day => day.day >= shiftDay(heartDay(Date.now()), -6));
    const report = buildHeartReport(raw, await catalogueProjection(), params);
    if (!extended) { report.comparable = false; report.previousAdded = 0; }
    return NextResponse.json({ ...report, plan },{headers});
  }
  catch(e) { const error = safeError(e); return NextResponse.json({error:error.message},{status:error.status,headers}); }
}
export async function POST(request: NextRequest) {
  try { sameOrigin(request); await requireOwner(request); const input = await readJson(request); if (typeof input.enabled !== 'boolean') throw new BusinessError('Kies of de meting aan of uit staat.'); return NextResponse.json(await heartConfig(input.enabled),{headers}); }
  catch(e) { const error = safeError(e); return NextResponse.json({error:error.message},{status:error.status,headers}); }
}
