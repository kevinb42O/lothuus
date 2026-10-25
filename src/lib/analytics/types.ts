export const periods = [
  ['24h', '24 uur'], ['7d', '7 dagen'], ['30d', '30 dagen'], ['3m', '3 maanden'],
  ['12m', '12 maanden'], ['year', 'Dit jaar'], ['all', 'Alles'],
] as const;
export type Period = typeof periods[number][0];
export const devices = ['desktop', 'mobile', 'tablet', 'unknown'] as const;
export type Device = typeof devices[number];
export const deviceNames: Record<Device, string> = { desktop: 'Desktop', mobile: 'Mobiel', tablet: 'Tablet', unknown: 'Onbekend' };
export type DayCount = { day: string; device: Device; visits: number };
export type Visit = { id: string; at: string; device: Device };
export type AnalyticsRaw = { enabled: boolean; startedAt: string; now: string; days: DayCount[]; events: (Omit<Visit, 'id'> & { id?: string; visits?: number })[] };
export type Point = { at: string; visits: number };
export type AnalyticsReport = {
  enabled: boolean; startedAt: string; updatedAt: string; from: string; to: string; period: Period;
  granularity: 'hour' | 'day' | 'month'; total: number; points: Point[];
  devices: { device: Device; visits: number }[];
  details: Point[]; page: number; pages: number; detailCount: number;
};
