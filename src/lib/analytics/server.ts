import { cloudMode, serverDatabase } from '../backend/cloud';
import { BusinessError } from '../backend/service';
import type { AnalyticsRaw, Device } from './types';
export async function recordVisit(id: string, device: Device) {
  if (cloudMode()) {
    const { error } = await serverDatabase().rpc('lothuus_analytics_visit', { event_id: id, device_kind: device });
    if (error) throw new BusinessError('De bezoekersmeting is tijdelijk niet bereikbaar.', 503);
  } else {
    if (process.env.NODE_ENV === 'production') throw new BusinessError('Online opslag ontbreekt.', 503);
    const { localVisit } = await import('./local'); localVisit(id, device);
  }
}
export async function analyticsRaw(from: string, to: string, rolling: boolean): Promise<AnalyticsRaw> {
  if (cloudMode()) {
    const { data, error } = await serverDatabase().rpc('lothuus_analytics_report', { from_day: from, report_to: to, rolling });
    if (error || !data) throw new BusinessError('De bezoekerscijfers zijn tijdelijk niet bereikbaar. Probeer opnieuw.', 503);
    return data as AnalyticsRaw;
  }
  if (process.env.NODE_ENV === 'production') throw new BusinessError('Online opslag ontbreekt.', 503);
  const { localRaw } = await import('./local'); return localRaw();
}
