import type { Category, CollectionObject } from '../collection';
export type Photo = { id: string; alt: string };
export type Item = { sourceReference?: string; sourcePhotoCount?: number; sourcePhotos?: Photo[]; materialGroup?: 'K' | 'P' | 'G' | 'T' | 'H' | 'I'; productNumber?: string; previousNumbers?: string[]; creationKey?: string; editorReady?: boolean; priceUnset?: boolean; updatedAt?: string; id: string; title: string; category: Category; description: string; priceCents: number; date: string; material: string; dimensions: string; maker: string; condition: string; publication: 'draft' | 'published' | 'archived'; photos: Photo[]; version: number; createdAt: string };
export type Customer = { id: string; name: string; email: string; phone: string; channel: 'email' | 'phone' | 'whatsapp'; notes: string; createdAt: string };
export type Payment = { id: string; type: 'receipt' | 'refund'; amountCents: number; date: string; note: string };
export type OrderLine = { pricePending?: boolean; itemId: string; title: string; image: string; productNumber: string; priceCents: number };
export type Notification = { id: string; reservationId: string; text: string; createdAt: string; read: boolean; resolved?: boolean };
export type Reservation = { pricePending?: boolean; paymentPending?: boolean; lines?: OrderLine[]; id: string; reference: string; itemId: string; customerId: string; title: string; image: string; priceCents: number; contact: Omit<Customer, 'id' | 'notes' | 'createdAt'>; message: string; status: 'active' | 'cancelled' | 'completed' | 'expired'; fulfilment: 'not_arranged' | 'pickup_arranged' | 'fulfilled'; createdAt: string; completedAt?: string; deadline: string; bank: { beneficiary: string; iban: string; instructions: string }; payments: Payment[]; events: { at: string; text: string }[]; tokenHash: string; termsVersion: string; source: 'web' | 'direct'; reminded: boolean; version: number };
export type Mail = { id: string; reservationId: string; to: string; subject: string; body: string; kind: 'customer' | 'owner' | 'receipt' | 'cancelled' | 'reminder'; status: 'preview'; createdAt: string };
export type Settings = { requestsEnabled?: boolean; businessName: string; ownerEmail: string; replyTo: string; beneficiary: string; iban: string; deadlineDays: number; pickup: string; terms: string; privacy: string; termsVersion: string; reservationsEnabled: boolean };
export type Store = { schemaVersion: 1; notifications?: Notification[]; itemNumbers?: Record<string, number>; items: Item[]; customers: Customer[]; reservations: Reservation[]; emails: Mail[]; settings: Settings; requests: Record<string, { hash: string; reservationId: string; token: string }>; limits: Record<string, { count: number; until: number }>; settingsVersion: number };
export type AdminStore = Omit<Store, 'requests' | 'limits' | 'reservations'> & { reservations: Omit<Reservation, 'tokenHash'>[] };
export type PublicObject = CollectionObject & { priceCents: number; availability: 'available' | 'reserved' | 'sold'; condition: string; version: number; photos: Photo[] };
export type PublicSettings = Pick<Settings, 'businessName' | 'pickup' | 'terms' | 'privacy' | 'termsVersion'> & { acceptsReservations: boolean; ready: boolean; deadlineDays: number };
export const money = (cents: number) => new Intl.NumberFormat('nl-BE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
export const dateTime = (value: string) => new Intl.DateTimeFormat('nl-BE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Brussels' }).format(new Date(value));
/** Preserve the local hour across Belgian daylight-saving changes. */
export function paymentDeadline(days: number, timestamp = Date.now()) {
  const parts = (value: number) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(value).map(p => [p.type, p.value]));
  const p = parts(timestamp);
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day + days, +p.hour, +p.minute, +p.second);
  let target = wall;
  for (let i = 0; i < 3; i++) {
    const local = parts(target);
    const offset = Date.UTC(+local.year, +local.month - 1, +local.day, +local.hour, +local.minute, +local.second) - Math.floor(target / 1000) * 1000;
    target = wall - offset;
  }
  return new Date(target).toISOString();
}
export const netPaid = (r: Pick<Reservation, 'payments'>) => r.payments.reduce((n, p) => n + (p.type === 'receipt' ? p.amountCents : -p.amountCents), 0);
export const reservationLines = (r: Pick<Reservation, 'itemId' | 'title' | 'image' | 'priceCents' | 'lines'>): OrderLine[] => r.lines || [{ itemId: r.itemId, title: r.title, image: r.image, productNumber: '', priceCents: r.priceCents }];
export const availability = (s: { items?: Pick<Item, 'id' | 'sourceReference'>[]; reservations: { itemId: string; status: string; lines?: OrderLine[]; payments?: Payment[]; priceCents?: number }[] }, id: string): 'available' | 'reserved' | 'sold' => {
  const item = s.items?.find(item => item.id === id || item.sourceReference === id);
  const ids = new Set([id, ...(item ? [item.id, item.sourceReference].filter((value): value is string => !!value) : [])]);
  const matches = s.reservations.filter(r => ids.has(r.itemId) || r.lines?.some(line => ids.has(line.itemId)));
  if (matches.some(r => r.status === 'completed' || r.status === 'active' && r.payments && r.priceCents && netPaid({ payments: r.payments }) >= r.priceCents)) return 'sold';
  return matches.some(r => r.status === 'active') ? 'reserved' : 'available';
};
/** New cart orders expire automatically. Existing single-object agreements retain their original review policy. */
export function expireOrders(s: Store, timestamp = Date.now()) {
  s.notifications ||= [];
  for (const r of s.reservations) {
    if (!r.lines || r.status !== 'active') continue;
    const remaining = Date.parse(r.deadline) - timestamp;
    const paid = netPaid(r);
    if ((r.paymentPending || paid < r.priceCents) && remaining <= 86400000 && (remaining > 0 || paid > 0)) {
      const id = `review:${r.id}:${r.deadline}`;
      if (!s.notifications.some(n => n.id === id)) s.notifications.unshift({ id, reservationId: r.id, text: r.paymentPending ? `${r.reference}: bevestig prijs en betaalafspraak vóór de reservering vervalt.` : `${r.reference}: controleer je bankrekening${paid > 0 ? ' en de gedeeltelijke betaling' : ' vóór de betaalafspraak vervalt'}.`, createdAt: new Date(timestamp).toISOString(), read: false });
    }
    if (remaining > 0 || paid !== 0) continue;
    r.status = 'expired'; r.version++;
    const at = new Date(timestamp).toISOString();
    r.events.push({ at, text: 'Betaalafspraak vervallen; objecten weer beschikbaar. Controleer eventuele late betalingen.' });
    s.notifications.unshift({ id: `expired:${r.id}`, reservationId: r.id, text: `${r.reference} is vervallen. Controleer eventuele late betalingen.`, createdAt: at, read: false });
  }
}
