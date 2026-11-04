import { NextRequest, NextResponse } from 'next/server';
import { requireOperator } from '@/lib/superadmin/auth';
import { operatorRpc } from '@/lib/superadmin/server';
import { hostingReport } from '@/lib/hosting/server';
import { BusinessError, safeError } from '@/lib/backend/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: NextRequest) {
  try {
    const { actor } = await requireOperator();
    const before = request.nextUrl.searchParams.get('before');
    if (before && !/^[1-9]\d{0,17}$/.test(before)) throw new BusinessError('Ongeldige positie in de activiteitenlijst.');
    const [report, hosting] = await Promise.all([
      operatorRpc('lothuus_operator_report', { actor, before_id: before || null }),
      hostingReport(true).then(data => ({ data, error: null })).catch(() => ({ data: null, error: 'Technische metingen zijn tijdelijk niet beschikbaar.' })),
    ]);
    return NextResponse.json({ ...report, hosting: hosting.data, technicalError: hosting.error }, { headers });
  } catch (e) { const error = safeError(e); return NextResponse.json({ error: error.message }, { status: error.status, headers }); }
}
