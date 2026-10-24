import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { objects as suppliedObjects } from '../collection';
import { missingFields } from '../inventory';
import { checkoutSchema, commandSchema, reservationSchema, validIban } from './validation';
import { availability, dateTime, money, netPaid, reservationLines, expireOrders, paymentDeadline, type Store, type Reservation, type Customer, type PublicObject, type Mail } from './types';
export class BusinessError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();
export const ready = (s: Store) => Boolean(s.settings.reservationsEnabled && s.settings.ownerEmail && s.settings.replyTo && s.settings.beneficiary && validIban(s.settings.iban) && s.settings.terms && s.settings.privacy);
export function limit(s: Store, key: string, max: number, milliseconds: number) {
  for (const [k, v] of Object.entries(s.limits)) if (v.until < Date.now()) delete s.limits[k];
  const bucket = s.limits[key] || { count: 0, until: Date.now() + milliseconds };
  if (bucket.count >= max) throw new BusinessError('Te veel pogingen. Probeer het later opnieuw.', 429);
  bucket.count++; s.limits[key] = bucket;
}
function publicAvailability(s: Store, id: string) {
  const item = s.items.find(item => item.id === id || item.sourceReference === id);
  const states = [availability(s, id), ...(item ? [availability(s, item.id), ...(item.sourceReference ? [availability(s, item.sourceReference)] : [])] : [])];
  return states.includes('sold') ? 'sold' as const : states.includes('reserved') ? 'reserved' as const : 'available' as const;
}
export function catalogue(s: Store) {
  const objects: PublicObject[] = s.items.filter(i => i.publication === 'published').map(i => ({ id: i.id, title: i.title, category: i.category, description: i.description, date: i.date, material: i.material, dimensions: i.dimensions, maker: i.maker, image: `/api/images/${i.photos[0]?.id}?size=grid`, source: '', credit: '', imageSource: '', license: '', priceCents: i.priceCents, condition: i.condition, availability: publicAvailability(s, i.id), version: i.version, photos: i.photos }));
  const reservedSources = new Set(s.reservations.flatMap(r => reservationLines(r).map(line => line.itemId)));
  const importedItems = new Map(s.items.filter(item => item.sourceReference).map(item => [item.sourceReference, item]));
  const sourceObjects = suppliedObjects.filter(o => {
    const imported = importedItems.get(o.id);
    if (imported?.publication === 'published' || imported?.publication === 'archived') return false;
    return !objects.length || importedItems.size > 0 || reservedSources.has(o.id);
  }).map(o => {
    const item = importedItems.get(o.id);
    // Follow the editor's selection using photos that are already public in the source catalogue.
    // Private uploads and unfinished product text stay private until publication.
    const selected = item?.photos.flatMap(photo => {
      const index = item.sourcePhotos?.findIndex(source => source.id === photo.id) ?? -1;
      return index >= 0 && o.photos?.[index]?.src ? [o.photos[index]] : [];
    }) || [];
    const photos = selected.length ? selected : o.photos;
    return { ...o, image: photos?.[0]?.src || o.image, photos, version: 1, availability: publicAvailability(s, o.id) };
  });
  const hasInventory = objects.length > 0;
  const { businessName, pickup, terms, privacy, termsVersion, deadlineDays } = s.settings;
  return { objects: [...objects, ...sourceObjects], hasInventory, settings: { businessName, pickup, terms, privacy, termsVersion, deadlineDays, acceptsReservations: s.settings.requestsEnabled !== false, ready: ready(s) }, local: true };
}
export function adminView(s: Store) {
  return { schemaVersion: s.schemaVersion, notifications: s.notifications || [], items: s.items, customers: s.customers, reservations: s.reservations.map(({ tokenHash: _secret, ...r }) => r), emails: s.emails, settings: s.settings, settingsVersion: s.settingsVersion };
}
function event(r: Reservation, text: string) { r.events.push({ at: now(), text }); r.version++; }
function queue(s: Store, r: Reservation, kind: Mail['kind'], token?: string) {
  const owner = kind === 'owner';
  const subject = kind === 'owner' ? `Nieuwe reservering — ${r.title}` : kind === 'receipt' ? `Betaling ontvangen — ${r.reference}` : kind === 'cancelled' ? `Reservering geannuleerd — ${r.reference}` : kind === 'reminder' ? `Betaaltermijn verstreken — ${r.reference}` : `Je reservering bij ${s.settings.businessName} — ${r.reference}`;
  const bank = r.paymentPending ? 'Je selectie is tijdelijk gereserveerd. De prijs en betaalgegevens worden nog bevestigd. Maak nog niets over. Na volledige betaling en bevestiging door Katrien zijn je objecten verkocht en klaar voor ophaling.' : `Besteltotaal: ${money(r.priceCents)}\nNog te betalen: ${money(Math.max(0, r.priceCents - netPaid(r)))}\nBegunstigde: ${r.bank.beneficiary}\nIBAN: ${r.bank.iban}\nMededeling: ${r.reference}\nBetaal uiterlijk: ${dateTime(r.deadline)}\n\n${r.bank.instructions}`;
  const privateToken = token || Object.values(s.requests).find(request => request.reservationId === r.id && request.token)?.token;
  const privateLink = !owner && privateToken && r.status === 'active' ? `\n\nPrivé-reserveringslink: ${process.env.APP_ORIGIN || 'http://localhost:3000'}/reservation#${privateToken}` : '';
  const body = `LOKAAL VOORBEELD — NIET VERSTUURD\n\n${subject}\n\n${reservationLines(r).map(line => `${line.title}${line.productNumber ? ` · ${line.productNumber}` : ''} — ${line.pricePending ? 'Prijs te bevestigen' : money(line.priceCents)}`).join('\n')}\nReferentie: ${r.reference}\n\n${owner ? `Klant: ${r.contact.name}\nE-mail: ${r.contact.email}\nTelefoon: ${r.contact.phone || 'Niet opgegeven'}\nVoorkeur: ${r.contact.channel}\nBericht: ${r.message || 'Geen bericht'}\n\n` : `Dag ${r.contact.name},\n\n`}${kind === 'cancelled' ? 'Je reservering is geannuleerd. Maak geen bedrag meer over.' : kind === 'receipt' ? `${netPaid(r) >= r.priceCents ? 'Je betaling is bevestigd. Je objecten staan voor je klaar.\n' : ''}Ontvangen saldo: ${money(netPaid(r))}.\nNog te betalen: ${money(Math.max(0, r.priceCents - netPaid(r)))}.` : bank}\n\nVragen? ${s.settings.replyTo}\n${s.settings.pickup}${privateLink}`;
  s.emails.unshift({ id: randomUUID(), reservationId: r.id, to: owner ? s.settings.ownerEmail : r.contact.email, subject, body, kind, status: 'preview', createdAt: now() });
}
function associateCustomer(s: Store, contact: Reservation['contact']) {
  let customer = s.customers.find(c => c.email === contact.email);
  if (!customer) { customer = { ...contact, id: randomUUID(), notes: '', createdAt: now() }; s.customers.unshift(customer); }
  return customer;
}
function makeReservation(s: Store, itemId: string, contact: Reservation['contact'], message: string, source: 'web' | 'direct'): { reservation: Reservation; token: string } {
  const item = s.items.find(i => i.id === itemId);
  if (!item || (source === 'web' && item.publication !== 'published')) throw new BusinessError('Dit object is niet beschikbaar.', 409);
  if (publicAvailability(s, itemId) !== 'available') throw new BusinessError('Dit object is intussen gereserveerd of verkocht.', 409);
  const token = randomBytes(32).toString('hex');
  const reservation: Reservation = { id: randomUUID(), reference: `LT-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`, itemId, customerId: associateCustomer(s, contact).id, title: item.title, image: item.photos[0] ? `/api/images/${item.photos[0].id}?size=thumb` : '', priceCents: item.priceCents, contact: { name: contact.name, email: contact.email, phone: contact.phone, channel: contact.channel }, message, status: 'active', fulfilment: 'not_arranged', createdAt: now(), deadline: paymentDeadline(s.settings.deadlineDays), bank: { beneficiary: s.settings.beneficiary, iban: s.settings.iban, instructions: s.settings.pickup }, payments: [], events: [], tokenHash: hash(token), termsVersion: s.settings.termsVersion, source, reminded: false, version: 1 };
  event(reservation, source === 'web' ? 'Reservering aangemaakt via de website.' : 'Directe verkoop aangemaakt door eigenaar.');
  s.reservations.unshift(reservation);
  return { reservation, token };
}
export function reserve(s: Store, raw: unknown) {
  const input = reservationSchema.parse(raw);
  const digest = hash(JSON.stringify(input));
  const previous = s.requests[input.key];
  if (previous) {
    if (previous.hash !== digest) throw new BusinessError('Deze aanvraagcode is al gebruikt voor andere gegevens.', 409);
    return publicReservation(s.reservations.find(r => r.id === previous.reservationId)!, previous.token);
  }
  if (!ready(s)) throw new BusinessError('Online reserveren is nog niet ingesteld. Probeer het later opnieuw.', 503);
  if (input.termsVersion !== s.settings.termsVersion) throw new BusinessError('De voorwaarden zijn gewijzigd. Open het formulier opnieuw.', 409);
  const item = s.items.find(i => i.id === input.itemId);
  if (!item || item.priceCents !== input.expectedPrice || item.version !== input.expectedVersion) throw new BusinessError('De objectgegevens of prijs zijn gewijzigd. Open het object opnieuw.', 409);
  limit(s, `email:${hash(input.contact.email)}`, 5, 3600000);
  const { reservation: r, token } = makeReservation(s, input.itemId, input.contact, input.message, 'web');
  queue(s, r, 'customer', token); queue(s, r, 'owner');
  s.requests[input.key] = { hash: digest, reservationId: r.id, token };
  return publicReservation(r, token);
}
export function checkout(s: Store, raw: unknown) {
  expireOrders(s);
  const input = checkoutSchema.parse(raw);
  const digest = hash(JSON.stringify(input));
  const previous = s.requests[input.key];
  if (previous) {
    if (previous.hash !== digest) throw new BusinessError('Deze aanvraagcode is al gebruikt voor andere gegevens.', 409);
    return publicReservation(s.reservations.find(r => r.id === previous.reservationId)!, previous.token);
  }
  if (s.settings.requestsEnabled === false) throw new BusinessError('Nieuwe reserveringen zijn tijdelijk gesloten. Je selectie blijft bewaard.', 503);
  if (input.termsVersion !== s.settings.termsVersion) throw new BusinessError('De voorwaarden zijn gewijzigd. Bekijk de actuele afspraken en probeer opnieuw.', 409);
  // Validate every line before mutating anything. The repository serializes the entire checkout.
  const lines = input.items.map(line => {
    const item = s.items.find(i => i.id === line.itemId);
    const source = item ? undefined : suppliedObjects.find(i => i.id === line.itemId);
    if (source && s.items.some(i => i.sourceReference === source.id && i.publication !== 'draft')) throw new BusinessError('De productfiche is gewijzigd. Bekijk je selectie opnieuw.', 409);
    if (!item && !source || item && item.publication !== 'published') throw new BusinessError('Een object is niet meer beschikbaar. Bekijk je selectie opnieuw.', 409);
    const unknownPrice = !!source || !!item?.priceUnset || !item?.priceCents;
    const price = unknownPrice ? null : item!.priceCents;
    const version = item?.version || 1;
    const title = item?.title || source!.title;
    if (price !== line.expectedPrice || version !== line.expectedVersion) throw new BusinessError(`${title}: prijs of gegevens gewijzigd. Bekijk je selectie opnieuw.`, 409);
    if (publicAvailability(s, line.itemId) !== 'available') throw new BusinessError(`${title} is intussen gereserveerd of verkocht. Bekijk je selectie opnieuw.`, 409);
    return { itemId: line.itemId, title, productNumber: item?.productNumber || source?.id || '', image: source?.image || (item?.photos[0] ? `/api/images/${item.photos[0].id}?size=thumb` : ''), priceCents: price || 0, pricePending: unknownPrice };
  });
  limit(s, `email:${hash(input.contact.email)}`, 5, 3600000);
  const token = randomBytes(32).toString('hex');
  const pricePending = lines.some(line => line.pricePending);
  const paymentPending = pricePending || !ready(s);
  const r: Reservation = {
    id: randomUUID(), reference: `LT-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`,
    itemId: lines[0].itemId, customerId: associateCustomer(s, input.contact).id,
    title: lines.map(line => line.title).join(' · '), image: lines[0].image,
    lines, priceCents: lines.reduce((sum, line) => sum + line.priceCents, 0), pricePending, paymentPending,
    contact: { ...input.contact }, message: input.message, status: 'active', fulfilment: 'not_arranged', createdAt: now(), deadline: paymentDeadline(s.settings.deadlineDays),
    bank: { beneficiary: paymentPending ? '' : s.settings.beneficiary, iban: paymentPending ? '' : s.settings.iban, instructions: s.settings.pickup },
    payments: [], events: [], tokenHash: hash(token), termsVersion: s.settings.termsVersion, source: 'web', reminded: false, version: 1,
  };
  event(r, `Selectie definitief doorgegeven: ${lines.length} ${lines.length === 1 ? 'object' : 'objecten'} tijdelijk gereserveerd.${paymentPending ? ' Prijs en betaalafspraak nog te bevestigen.' : ''}`);
  s.reservations.unshift(r);
  queue(s, r, 'customer', token); queue(s, r, 'owner');
  s.notifications ||= [];
  s.notifications.unshift({ id: `new:${r.id}`, reservationId: r.id, text: `Nieuwe bestelling van ${r.contact.name} · ${lines.length} ${lines.length === 1 ? 'object' : 'objecten'} · ${r.pricePending ? 'Prijs te bevestigen' : money(r.priceCents)}`, createdAt: now(), read: false });
  s.requests[input.key] = { hash: digest, reservationId: r.id, token };
  return publicReservation(r, token);
}
export function publicReservation(r: Reservation, token?: string) {
  return { pricePending: !!r.pricePending, paymentPending: !!r.paymentPending, lines: reservationLines(r), fulfilment: r.fulfilment, id: r.id, reference: r.reference, title: r.title, priceCents: r.priceCents, status: r.status, deadline: r.deadline, bank: r.bank, paidCents: netPaid(r), ...(token ? { token } : {}), local: true };
}
export function reviewOverdue(s: Store) {
  for (const r of s.reservations) if (r.status === 'active' && !r.reminded && Date.parse(r.deadline) < Date.now() && netPaid(r) < r.priceCents) { r.reminded = true; event(r, 'Betaaltermijn verstreken. Controleer de bank voor je het object vrijgeeft.'); queue(s, r, 'reminder'); }
}
function nextProductNumber(s: Store, group: string) {
  s.itemNumbers ||= {};
  const issued = s.items.flatMap(i => [i.productNumber, ...(i.previousNumbers || [])]).filter((n): n is string => Boolean(n?.startsWith(group)));
  const highest = Math.max(s.itemNumbers[group] || 0, ...issued.map(n => Number(n.slice(1)) || 0));
  s.itemNumbers[group] = highest + 1;
  return `${group}${highest + 1}`;
}
export function command(s: Store, raw: unknown) {
  const c = commandSchema.parse(raw);
  if (c.action === 'prepare-payment') {
    const r = s.reservations.find(r => r.id === c.id);
    if (!r || r.status !== 'active') throw new BusinessError('Deze reservering is niet actief.', 409);
    if (r.version !== c.version) throw new BusinessError('Reservering gewijzigd. Vernieuw eerst.', 409);
    if (!r.paymentPending || netPaid(r) !== 0) throw new BusinessError('De betaalafspraak is al vastgelegd.');
    if (!s.settings.beneficiary || !validIban(s.settings.iban)) throw new BusinessError('Vul eerst de begunstigde en een geldig rekeningnummer in bij Instellingen.');
    const lines = reservationLines(r);
    if (c.prices.length !== lines.length || new Set(c.prices.map(p => p.itemId)).size !== lines.length || lines.some(line => !c.prices.some(p => p.itemId === line.itemId))) throw new BusinessError('Bevestig de prijs van elk object.');
    r.lines = lines.map(line => ({ ...line, priceCents: c.prices.find(p => p.itemId === line.itemId)!.priceCents, pricePending: false }));
    r.priceCents = r.lines.reduce((sum, line) => sum + line.priceCents, 0); r.pricePending = false; r.paymentPending = false;
    r.bank = { beneficiary: s.settings.beneficiary, iban: s.settings.iban, instructions: s.settings.pickup };
    r.deadline = paymentDeadline(s.settings.deadlineDays); r.reminded = false;
    event(r, 'Prijs en betaalafspraak bevestigd. De betaaltermijn begint nu. E-mail alleen als lokaal voorbeeld bewaard.');
    queue(s, r, 'customer');
    s.notifications ||= []; s.notifications.unshift({ id: `instructions:${r.id}`, reservationId: r.id, text: `${r.reference}: betaalafspraak klaar. Bezorg de klant de instructies; automatische e-mail is nog niet aangesloten.`, createdAt: now(), read: false });
  } else if (c.action === 'read-notification'  || c.action === 'resolve-notification') {
    const notification = s.notifications?.find(n => n.id === c.id);
    if (notification) { notification.read = true; if (c.action === 'resolve-notification') notification.resolved = true; }
  } else if (c.action === 'save-item') {
    const input = c.item;
    if (input.publication === 'published' && (input.title.trim().length < 2 || input.priceUnset || !input.description || input.priceCents <= 0 || !input.photos.length)) throw new BusinessError('Publiceren vereist een beschrijving, positieve prijs en minstens één foto.');
    // Media readiness is enforced by the persistence boundary (Postgres FK/check or local repository).
    const previousCreation = !input.id && input.creationKey ? s.items.find(i => i.creationKey === input.creationKey) : undefined;
    if (previousCreation) return;
    const item = s.items.find(i => i.id === input.id);
    if (item?.productNumber && item.materialGroup !== input.materialGroup) throw new BusinessError('Dit product heeft al een vast nummer. De materiaalgroep kan niet meer worden gewijzigd.');
    if ((input.editorReady || input.materialGroup && input.publication === 'published') && missingFields(input).length) throw new BusinessError('Vul eerst de ontbrekende gegevens aan en kies 2 tot 8 foto’s.');
    if (input.materialGroup && input.photos.length > 8 && input.photos.length > (item?.photos.length || 0)) throw new BusinessError('Gebruik maximaal 8 foto’s. Bestaande foto’s blijven behouden.');
    if (input.id && !item) throw new BusinessError('Object niet gevonden.', 404);
    if (item && item.version !== input.version) throw new BusinessError('Dit object is elders gewijzigd. Vernieuw de pagina.', 409);
    if (item && availability(s, item.id) !== 'available' && item.priceCents !== input.priceCents) throw new BusinessError('Wijzig geen prijs tijdens een reservering of na verkoop.');
    let productNumber = item?.productNumber;
    if (input.materialGroup && !productNumber) {
      productNumber = nextProductNumber(s, input.materialGroup);
    }
    if (item) Object.assign(item, input, { productNumber, updatedAt: now(), version: item.version + 1 });
    else s.items.unshift({ ...input, productNumber, updatedAt: now(), id: randomUUID(), version: 1, createdAt: now() });
  } else if (c.action === 'save-item-photos') {
    const item = s.items.find(i => i.id === c.id);
    if (!item) throw new BusinessError('Product niet gevonden.', 404);
    if (item.version !== c.version) throw new BusinessError('Dit object is elders gewijzigd. Vernieuw de pagina.', 409);
    if (new Set(c.photos.map(photo => photo.id)).size !== c.photos.length) throw new BusinessError('Een foto mag maar één keer op de fiche staan.');
    if (c.photos.length > 8 && c.photos.length > item.photos.length) throw new BusinessError('Gebruik maximaal 8 foto’s. Bestaande foto’s blijven behouden.');
    if (item.publication === 'published' && !c.photos.length) throw new BusinessError('Een gepubliceerd product heeft minstens één foto nodig.');
    item.photos = c.photos;
    if (item.editorReady && missingFields(item).length) item.editorReady = false;
    item.updatedAt = now(); item.version++;
  } else if (c.action === 'change-material') {
    const item = s.items.find(i => i.id === c.id);
    if (!item) throw new BusinessError('Product niet gevonden.', 404);
    if (item.version !== c.version) throw new BusinessError('Dit product is elders gewijzigd. Vernieuw de pagina.', 409);
    if (item.materialGroup === c.materialGroup) return;
    if (availability(s, item.id) !== 'available') throw new BusinessError('Corrigeer geen productnummer tijdens een reservering of na verkoop.');
    if (item.productNumber) item.previousNumbers = [...(item.previousNumbers || []), item.productNumber];
    item.productNumber = nextProductNumber(s, c.materialGroup);
    item.materialGroup = c.materialGroup;
    item.updatedAt = now(); item.version++;
  } else if (c.action === 'save-settings') {
    if (c.version !== s.settingsVersion) throw new BusinessError('Instellingen zijn elders gewijzigd. Vernieuw eerst.', 409);
    const next = c.settings;
    if (next.iban && !validIban(next.iban)) throw new BusinessError('Het IBAN heeft geen geldige controlecode.');
    if (next.reservationsEnabled && (!next.ownerEmail || !next.replyTo || !next.beneficiary || !next.iban || !next.terms || !next.privacy)) throw new BusinessError('Vul bankgegevens, e-mailadressen, voorwaarden en privacytekst in voordat je reserveringen activeert.');
    const changed = next.terms !== s.settings.terms || next.privacy !== s.settings.privacy;
    if (changed && next.termsVersion === s.settings.termsVersion) next.termsVersion = `${Date.now()}`;
    s.settings = next; s.settingsVersion++;
  } else if (c.action === 'save-customer') {
    const input = c.customer;
    if (input.channel !== 'email' && input.phone.length < 6) throw new BusinessError('Vul een telefoonnummer in voor deze contactmethode.');
    if (s.customers.some(p => p.id !== input.id && p.email === input.email)) throw new BusinessError('Er bestaat al een klant met dit e-mailadres.');
    const existing = s.customers.find(p => p.id === input.id);
    if (input.id && !existing) throw new BusinessError('Klant niet gevonden.', 404);
    if (existing) Object.assign(existing, input); else s.customers.unshift({ ...input, id: randomUUID(), createdAt: now() });
  } else if (c.action === 'merge-customers') {
    if (c.sourceId === c.targetId) throw new BusinessError('Kies een andere klant.');
    const source = s.customers.find(p => p.id === c.sourceId); const target = s.customers.find(p => p.id === c.targetId);
    if (!source || !target) throw new BusinessError('Klant niet gevonden.', 404);
    if (source.notes) target.notes = [target.notes, `Samengevoegde notities (${source.name}): ${source.notes}`].filter(Boolean).join('\n\n');
    for (const r of s.reservations.filter(r => r.customerId === source.id)) { r.customerId = target.id; event(r, 'Klantfiches samengevoegd door eigenaar. Oorspronkelijke contactgegevens bewaard.'); }
    s.customers = s.customers.filter(p => p.id !== source.id);
  } else if (c.action === 'correct-contact') {
    const r = s.reservations.find(r => r.id === c.id); if (!r) throw new BusinessError('Reservering niet gevonden.', 404);
    if (r.version !== c.version) throw new BusinessError('Reservering gewijzigd. Vernieuw eerst.', 409);
    r.contact = c.contact; event(r, 'Contactgegevens van deze reservering gecorrigeerd door eigenaar.');
  } else if (c.action === 'direct-sale') {
    const digest = hash(JSON.stringify(c));
    if (s.requests[c.key]) { if (s.requests[c.key].hash !== digest) throw new BusinessError('Aanvraagcode al gebruikt.', 409); return; }
    const customer = s.customers.find(p => p.id === c.customerId);
    if (!customer) throw new BusinessError('Klant niet gevonden.', 404);
    const item = s.items.find(i => i.id === c.itemId);
    if (!item || item.priceCents <= 0) throw new BusinessError('Stel eerst een positieve prijs in.');
    const { reservation: r } = makeReservation(s, c.itemId, customer, '', 'direct');
    r.payments.push({ id: randomUUID(), type: 'receipt', amountCents: r.priceCents, date: now(), note: 'Directe verkoop: betaling door eigenaar bevestigd.' });
    r.status = 'completed'; r.completedAt = now(); r.fulfilment = 'fulfilled'; event(r, 'Directe verkoop afgerond en betaling geregistreerd.');
    s.requests[c.key] = { hash: digest, reservationId: r.id, token: '' };
  } else {
    const r = s.reservations.find(r => r.id === c.id);
    if (!r) throw new BusinessError('Reservering niet gevonden.', 404);
    if (c.action === 'payment') {
      const digest = hash(JSON.stringify(c));
      if (s.requests[c.key]) { if (s.requests[c.key].hash !== digest) throw new BusinessError('Aanvraagcode al gebruikt.', 409); return; }
      if (r.version !== c.version) throw new BusinessError('Reservering gewijzigd. Vernieuw eerst.', 409);
      if (c.type === 'receipt' && (r.pricePending || r.paymentPending || r.priceCents <= 0)) throw new BusinessError('Bevestig eerst de prijs en betaalafspraak.');
      if (c.type === 'receipt' && r.status !== 'active' && r.status !== 'expired') throw new BusinessError('Nieuwe ontvangsten horen bij een actieve of vervallen bestelling.');
      if (c.type === 'refund' && c.amountCents > netPaid(r)) throw new BusinessError('Je kunt niet meer terugbetalen dan het ontvangen saldo.');
      if (Date.parse(c.date) > Date.now() + 86400000) throw new BusinessError('De betaaldatum ligt in de toekomst.');
      r.payments.push({ id: randomUUID(), type: c.type, amountCents: c.amountCents, date: c.date, note: c.note });
      event(r, `${r.status === 'expired' ? 'Late betaling — controleer beschikbaarheid of betaal terug. ' : ''}${c.type === 'receipt' ? 'Ontvangst' : 'Terugbetaling'} geregistreerd: ${money(c.amountCents)}.`);
      if (c.type === 'receipt' && r.status !== 'expired') queue(s, r, 'receipt');
      if (c.type === 'receipt') { s.notifications ||= []; s.notifications.unshift({ id: `payment:${c.key}`, reservationId: r.id, text: r.status === 'expired' ? `${r.reference}: late betaling ontvangen. Controleer of terugbetaling nodig is.` : netPaid(r) >= r.priceCents ? `${r.reference}: betaald. Zet de objecten klaar en spreek ophalen af.` : `${r.reference}: gedeeltelijke betaling ontvangen.`, createdAt: now(), read: false }); }
      s.requests[c.key] = { hash: digest, reservationId: r.id, token: '' };
    } else {
      if (r.version !== c.version) throw new BusinessError('Reservering gewijzigd. Vernieuw eerst.', 409);
      if (c.operation === 'resend') {
        if (r.status !== 'active' || netPaid(r) >= r.priceCents) throw new BusinessError('Alleen onbetaalde actieve bestellingen hebben betaalinstructies.');
        queue(s, r, 'customer'); event(r, 'Nieuw e-mailvoorbeeld met betaalinstructies gemaakt.');
      } else {
        if (r.status !== 'active') throw new BusinessError('Deze reservering is al afgesloten.');
        if (c.operation === 'cancel') { if (netPaid(r) !== 0) throw new BusinessError('Registreer eerst de terugbetaling voordat je het object vrijgeeft.'); r.status = 'cancelled'; queue(s, r, 'cancelled'); event(r, 'Geannuleerd door eigenaar na bankcontrole.'); }
        if (c.operation === 'complete') { if (r.paymentPending || r.pricePending || r.priceCents <= 0) throw new BusinessError('Bevestig eerst de prijs en volledige betaling.'); if (netPaid(r) < r.priceCents) throw new BusinessError('Registreer eerst de volledige betaling.'); if (netPaid(r) > r.priceCents) throw new BusinessError('Registreer eerst de terugbetaling van het te veel ontvangen bedrag.'); r.status = 'completed'; r.completedAt = now(); r.fulfilment = 'fulfilled'; event(r, 'Verkoop afgerond en object overgedragen.'); }
        if (c.operation === 'pickup') { if (r.paymentPending || r.pricePending || r.priceCents <= 0) throw new BusinessError('Bevestig eerst de prijs en volledige betaling.'); if (netPaid(r) < r.priceCents) throw new BusinessError('Bevestig eerst de volledige betaling voordat je ophalen vastlegt.'); r.fulfilment = 'pickup_arranged'; event(r, 'Ophalen afgesproken.'); }
        if (c.operation === 'extend') { if (!c.deadline || Date.parse(c.deadline) <= Date.now()) throw new BusinessError('Kies een toekomstige datum.'); r.deadline = c.deadline; r.reminded = false; event(r, 'Betaaltermijn verlengd.'); }
      }
    }
  }
}
export function safeError(error: unknown) {
  if (error instanceof z.ZodError) return { message: error.issues[0]?.message || 'Controleer de ingevoerde gegevens.', status: 400 };
  if (error instanceof BusinessError) return { message: error.message, status: error.status };
  console.error('LOTHUUS backend error:', error instanceof Error ? error.name : 'unknown');
  return { message: 'Opslaan is niet gelukt. Probeer opnieuw.', status: 500 };
}
