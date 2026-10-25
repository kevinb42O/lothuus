import type { Period } from './types';
const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit' });
export function localDay(value: number | string | Date) { return dateFormatter.format(new Date(value)); }
export function shiftDay(day: string, amount: number) {
  const value = new Date(`${day}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}
export function midnight(day: string) {
  const target = Date.parse(`${day}T00:00:00Z`);
  const format = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  let instant = target;
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(format.formatToParts(instant).map(p => [p.type, p.value]));
    const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    instant += target - wall;
  }
  return instant;
}
function monthsBack(day: string, amount: number) {
  const [year, month, date] = day.split('-').map(Number);
  const first = new Date(Date.UTC(year, month - 1 - amount, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(date, last)); return first.toISOString().slice(0, 10);
}
export function periodStart(period: Period, to: number, startedAt: string) {
  const today = localDay(to);
  const day = period === '7d' ? shiftDay(today, -6) : period === '30d' ? shiftDay(today, -29)
    : period === '3m' ? monthsBack(today, 3) : period === '12m' ? monthsBack(today, 12)
    : period === 'year' ? `${today.slice(0, 4)}-01-01` : localDay(startedAt);
  return Math.max(Date.parse(startedAt), period === '24h' ? to - 86400000 : midnight(day));
}
