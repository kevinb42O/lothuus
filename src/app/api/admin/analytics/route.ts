import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/backend/auth';
import { BusinessError, safeError } from '@/lib/backend/service';
import { analyticsRaw } from '@/lib/analytics/server';
import { buildReport } from '@/lib/analytics/report';
import { localDay, periodStart } from '@/lib/analytics/time';
import { periods, type Period } from '@/lib/analytics/types';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: NextRequest) {
  try {
    await requireOwner(request);
    const params = request.nextUrl.searchParams, period = (params.get('period') || '7d') as Period;
    if (!periods.some(([key]) => key === period)) throw new BusinessError('Kies een geldige periode.');
    const now = Date.now(), to = params.has('to') ? Date.parse(params.get('to')!) : now;
    const page = Number(params.get('page') || 1);
    if (!Number.isFinite(to) || to > now + 1000 || to < now - 15 * 60000 || !Number.isInteger(page) || page < 1 || page > 100000) throw new BusinessError('Vernieuw de cijfers om deze periode te bekijken.');
    const start = period === 'all' ? '1970-01-01' : localDay(periodStart(period, to, '1970-01-01T00:00:00Z'));
    const raw = await analyticsRaw(start, new Date(to).toISOString(), period === '24h');
    return NextResponse.json(buildReport(raw, period, Math.min(to, Date.parse(raw.now)), page), { headers });
  } catch (e) { const error = safeError(e); return NextResponse.json({ error: error.message }, { status: error.status, headers }); }
}
