import { z } from 'zod';
import { serverDatabase, cloudMode } from '../backend/cloud';
import { BusinessError } from '../backend/service';

export const operatorCommand = z.discriminatedUnion('action', [
  z.object({ action: z.literal('policy'), version: z.number().int().positive(), enforced: z.boolean(), limit: z.number().int().min(1).max(100000).nullable(), expiresAt: z.iso.datetime({ offset: true }).nullable(), reason: z.string().trim().min(3).max(500) }).strict(),
  z.object({ action: z.literal('activate'), orderId: z.uuid(), receipt: z.string().trim().min(3).max(180), provisioned: z.boolean() }).strict(),
]);
export async function operatorRpc(name: string, args?: Record<string, unknown>) {
  const { data, error } = await serverDatabase().rpc(name, args);
  if (error) {
    if (error.message.includes('OPERATOR_VERSION_CONFLICT')) throw new BusinessError('De instellingen zijn intussen gewijzigd. Vernieuw en probeer opnieuw.', 409);
    if (error.message.includes('OPERATOR_FORBIDDEN')) throw new BusinessError('Je hebt geen toegang tot deze handeling.', 403);
    if (error.message.includes('INVALID_POLICY')) throw new BusinessError('Controleer de limiet, einddatum en reden.', 400);
    // Bank/provisioning validation messages are intentionally not exposed verbatim.
    console.error('[superadmin]', name, error.code);
    throw new BusinessError('De handeling kon niet worden voltooid. Controleer de bestelling of vernieuw de gegevens.', 503);
  }
  return data;
}
export async function recordActivity(actor: string | undefined, kind: string, objectId?: string, title?: string) {
  if (!cloudMode()) return;
  try { await operatorRpc('lothuus_record_activity', { actor: actor || null, event_kind: kind, object_key: objectId || null, event_title: title || '' }); }
  catch { console.error('[superadmin] activity recording unavailable'); }
}
export async function capacityPolicy(): Promise<{ count: number; limit: number; enforced: boolean }> {
  if (!cloudMode()) {
    const { localReport } = await import('../hosting/local');
    const report = localReport(); return { count: report.count, limit: report.limit, enforced: true };
  }
  const data = await operatorRpc('lothuus_capacity_policy');
  if (!Number.isSafeInteger(data?.count) || data.count < 0 || !Number.isSafeInteger(data.limit) || data.limit < 1 || typeof data.enforced !== 'boolean') throw new BusinessError('Je pakketlimiet kan nu niet worden gecontroleerd. Je invoer blijft behouden.', 503);
  return data;
}
