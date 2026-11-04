import { NextRequest, NextResponse } from 'next/server';
import { requireOwner, sameOrigin, throttle } from '@/lib/backend/auth';
import { capacityPolicy, recordActivity } from '@/lib/superadmin/server';
import { safeError } from '@/lib/backend/service';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
 try {
  sameOrigin(request); const actor = await requireOwner(request); await throttle(request, 'capacity-attempt', 60);
  const policy = await capacityPolicy();
  if (policy.enforced && policy.count >= policy.limit) await recordActivity(actor, 'capacity_denied');
  return NextResponse.json({ recorded: true }, { headers: { 'Cache-Control': 'private, no-store' } });
 } catch (e) { const error = safeError(e); return NextResponse.json({ error: error.message }, { status: error.status }); }
}
