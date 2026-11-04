import { NextRequest, NextResponse } from 'next/server';
import { readJson, sameOrigin, throttle } from '@/lib/backend/auth';
import { requireOperator } from '@/lib/superadmin/auth';
import { operatorCommand, operatorRpc } from '@/lib/superadmin/server';
import { BusinessError, safeError } from '@/lib/backend/service';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store' };
export async function POST(request: NextRequest) {
 try {
  sameOrigin(request); const { actor } = await requireOperator(); await throttle(request, 'superadmin-manage', 30);
  const parsed = operatorCommand.safeParse(await readJson(request));
  if (!parsed.success) throw new BusinessError('Controleer de ingevulde gegevens en vermeld een reden of bankreferentie.');
  const input = parsed.data;
  if (input.action === 'policy') await operatorRpc('lothuus_operator_policy', { actor, expected_version: input.version, enforce: input.enforced, object_quota: input.limit, until_at: input.expiresAt, reason: input.reason });
  else await operatorRpc('lothuus_operator_activate', { actor, order_key: input.orderId, receipt: input.receipt, provisioned: input.provisioned });
  return NextResponse.json({ saved: true }, { headers });
 } catch (e) { const error = safeError(e); return NextResponse.json({ error: error.message }, { status: error.status, headers }); }
}
