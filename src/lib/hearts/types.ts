export type HeartAction = { id: string; selected: boolean; sequence: number; baseline?: boolean };
export type HeartObject = { id: string; title: string; reference: string; image: string; category: string; source: 'collection' | 'inventory' };
export type HeartDay = { day: string; id: string; added: number; removed: number; ordered: number };
export type HeartRaw = { enabled: boolean; startedAt: string; objects: HeartObject[]; days: HeartDay[]; recent: { id: string; count: number; lastSeen: string }[] };
export type HeartRow = HeartObject & { added: number; removed: number; ordered: number; recent: number; lastSeen: string | null; availability: string; itemId?: string; reservations: number; cancelled: number };
export type HeartReport = { enabled: boolean; startedAt: string; updatedAt: string; from: string; to: string; comparable: boolean; previousAdded: number; totals: { added: number; removed: number; objects: number }; series: { day: string; added: number; removed: number; ordered: number }[]; rows: HeartRow[]; totalRows: number; page: number; pages: number; categories: string[]; detail: HeartRow | null };
export const heartDay = (time: Date | number | string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(time));
export function shiftDay(day: string, amount: number) { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10); }

/** PostgreSQL-compatible calendar subtraction, including leap days and month ends. */
export function monthsBefore(day: string, months: number) {
  const [year,month,date] = day.split('-').map(Number);
  const first = new Date(Date.UTC(year,month-1-months,1));
  const last = new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  first.setUTCDate(Math.min(date,last)); return first.toISOString().slice(0,10);
}
