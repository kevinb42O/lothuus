import { randomUUID } from 'node:crypto';
import { cloudMode, serverDatabase } from '../backend/cloud';
type ProviderUsage = { usages: { metric: string; usage_original: number }[] };
export function parseSupabaseUsage(usage: ProviderUsage, subscription: { current_period_start: number; current_period_end: number }) {
  const value = usage?.usages?.find(row => row.metric === 'EGRESS')?.usage_original;
  const start = subscription?.current_period_start * 1000, end = subscription?.current_period_end * 1000;
  if (!Number.isFinite(value) || Number(value) < 0 || !Number.isFinite(start) || !Number.isFinite(end) || start > Date.now() || end <= Date.now() || start >= end) throw new Error('Invalid provider usage');
  const configured = Number(process.env.SUPABASE_EGRESS_LIMIT_BYTES || 5000000000);
  if (!Number.isSafeInteger(configured) || configured <= 0) throw new Error('Invalid egress quota');
  return { value: Math.ceil(value!), limit: configured, measuredAt: new Date().toISOString(), periodStart: new Date(start).toISOString(), periodEnd: new Date(end).toISOString(), level: value! >= configured * .85 ? 'danger' : value! >= configured * .7 ? 'warning' : 'normal' };
}
export async function refreshSupabaseUsage() {
  if (!cloudMode()) return { skipped: true };
  const db = serverDatabase(), id = randomUUID();
  const claim = await db.rpc('lothuus_maintenance_claim', { job_name: 'supabase-usage', job_id: id });
  if (claim.error) throw new Error('Usage maintenance claim failed');
  if (!claim.data) return { skipped: true };
  const token = process.env.SUPABASE_USAGE_TOKEN;
  try {
    if (!token || !process.env.SUPABASE_URL) throw new Error('Usage connection missing');
    const get = async (path: string) => {
      const r = await fetch('https://api.supabase.com' + path, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(12000) });
      if (!r.ok) throw new Error('Usage provider unavailable'); return r.json();
    };
    const ref = new URL(process.env.SUPABASE_URL).hostname.split('.')[0];
    const project = await get(`/v1/projects/${encodeURIComponent(ref)}`);
    const org = project.organization_slug || project.organization_id;
    if (project.id !== ref || typeof org !== 'string' || !/^[a-z0-9-]+$/.test(org)) throw new Error('Usage project mismatch');
    const [usage, subscription] = await Promise.all([
      get(`/platform/organizations/${org}/usage`), get(`/platform/organizations/${org}/billing/subscription`),
    ]);
    // Organization-wide totals match the provider's shared quota; do not filter to this project.
    const sample = parseSupabaseUsage(usage, subscription);
    const finished = await db.rpc('lothuus_maintenance_finish', { job_name: 'supabase-usage', job_id: id, succeeded: true, metadata: sample });
    if (finished.error) throw new Error('Usage sample not saved');
    if (sample.level !== 'normal') console.warn('[usage] Supabase egress threshold reached', { level: sample.level });
    return { completed: true };
  } catch {
    await db.rpc('lothuus_maintenance_finish', { job_name: 'supabase-usage', job_id: id, succeeded: false, metadata: { error: token ? 'Provider usage unavailable' : 'Usage connection missing' } });
    return { failed: true };
  }
}
