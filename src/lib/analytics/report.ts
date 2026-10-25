import { devices, type AnalyticsRaw, type AnalyticsReport, type Period, type Point } from './types';
import { localDay, periodStart, shiftDay } from './time';

export function buildReport(raw: AnalyticsRaw, period: Period, to = Date.parse(raw.now), page = 1): AnalyticsReport {
  const from = Math.min(to, periodStart(period, to, raw.startedAt));
  const totals = new Map(devices.map(device => [device, 0]));
  const daily = new Map<string, number>();
  const details: Point[] = [];
  if (period === '24h') {
    // Keep 24 equally sized, real-hour bins even across a clock change.
    const start = to - 86400000;
    for (let i = 0; i < 24; i++) if (start + (i + 1) * 3600000 > from) details.push({ at: new Date(Math.max(from, start + i * 3600000)).toISOString(), visits: 0 });
    for (const event of raw.events) {
      const at = Date.parse(event.at); if (at < from || at >= to) continue;
      const index = Math.min(details.length - 1, Math.max(0, Math.floor((at - start) / 3600000) - (24 - details.length)));
      const amount = event.visits ?? 1;
      if (details[index]) details[index].visits += amount;
      totals.set(event.device, totals.get(event.device)! + amount);
    }
  } else {
    for (const d of raw.days) {
      if (d.day < localDay(from) || d.day > localDay(to)) continue;
      daily.set(d.day, (daily.get(d.day) || 0) + d.visits);
      totals.set(d.device, totals.get(d.device)! + d.visits);
    }
    // Snapshot pagination: remove visits accepted after the chosen report cutoff.
    for (const event of raw.events) {
      if (Date.parse(event.at) < to) continue;
      const day = localDay(event.at); if (!daily.has(day)) continue;
      const amount = event.visits ?? 1;
      daily.set(day, daily.get(day)! - amount); totals.set(event.device, totals.get(event.device)! - amount);
    }
    for (let day = localDay(from); day <= localDay(to); day = shiftDay(day, 1)) details.push({ at: day, visits: daily.get(day) || 0 });
  }
  const monthly = period === '12m' || period === 'year' || period === 'all' && details.length > 90;
  const grouped = new Map<string, number>();
  for (const point of details) { const key = monthly ? point.at.slice(0, 7) + '-01' : point.at; grouped.set(key, (grouped.get(key) || 0) + point.visits); }
  const points = Array.from(grouped, ([at, visits]) => ({ at, visits }));
  const pages = Math.max(1, Math.ceil(details.length / 50)); page = Math.min(pages, Math.max(1, Math.trunc(page)));
  return { enabled: raw.enabled, startedAt: raw.startedAt, updatedAt: new Date(to).toISOString(), from: new Date(from).toISOString(), to: new Date(to).toISOString(), period,
    granularity: period === '24h' ? 'hour' : monthly ? 'month' : 'day', total: [...totals.values()].reduce((a, b) => a + b, 0),
    devices: devices.map(device => ({ device, visits: totals.get(device)! })), points, details: details.slice((page - 1) * 50, page * 50), page, pages, detailCount: details.length };
}
