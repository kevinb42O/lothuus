'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpRight, Check, Copy, Heart, X } from 'lucide-react';
import { Dialog } from './dialog';
import { LegalLinks } from './legal-page';
import { heartOrderContext } from '@/lib/hearts/client';
import type { CollectionObject } from '@/lib/collection';
import { dateTime, money, type OrderLine, type PublicSettings } from '@/lib/backend/types';

export type ReservationResult = { pricePending?: boolean; paymentPending?: boolean; id: string; reference: string; title: string; lines?: OrderLine[]; priceCents: number; status: string; fulfilment?: string; deadline: string; bank: { beneficiary: string; iban: string; instructions: string }; paidCents: number; token?: string; local: boolean };
export function ReservationConfirmation({ result: initialResult }: { result: ReservationResult }) {
  const [result, setResult] = useState(initialResult);
  const [statusError, setStatusError] = useState('');
  useEffect(() => { setResult(initialResult); }, [initialResult]);
  useEffect(() => {
    if (!initialResult.token || result.status !== 'active') return;
    let cancelled = false; let loading = false; let lastLoaded = Date.now(); let failures = 0; let timer: ReturnType<typeof setTimeout>; const controller = new AbortController();
    const refresh = async () => {
      if (document.hidden || loading) return;
      loading = true;
      try {
        const response = await fetch('/api/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation: 'status', token: initialResult.token }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
        const body = await response.json(); if (!response.ok) throw new Error();
        if (!cancelled) { lastLoaded = Date.now(); failures = 0; setResult({ ...body, token: initialResult.token }); setStatusError(''); }
      } catch { failures++; if (!cancelled) setStatusError('De actuele bestelstatus kan niet worden opgehaald. Controleer je verbinding en open je privélink opnieuw voordat je betaalt.'); }
      finally { loading = false; }
    };
    const schedule = () => { timer = setTimeout(async () => { await refresh(); if (!cancelled) schedule(); }, Math.min(300000, 60000 * 2 ** failures)); };
    schedule();
    const focus = () => { if (Date.now() - lastLoaded >= 60000) void refresh(); }; window.addEventListener('focus', focus);
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); window.removeEventListener('focus', focus); };
  }, [initialResult.token, result.status]);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { resultHeading.current?.focus(); }, []);
  const [copied, setCopied] = useState(false);
  const paid = !result.pricePending && !result.paymentPending && result.priceCents > 0 && result.paidCents >= result.priceCents;
  const active = result.status === 'active';
  const url = result.token && typeof window !== 'undefined' ? `${window.location.origin}/reservation#${result.token}` : '';
  return <div className="reservation-confirmation">
    <h2 ref={resultHeading} tabIndex={-1}>{result.status === 'expired' ? 'Je betaalafspraak is vervallen.' : result.status === 'cancelled' ? 'Bestelling geannuleerd.' : result.status === 'completed' ? 'Bedankt voor je aankoop.' : paid ? 'Je betaling is bevestigd.' : 'Voor jou gereserveerd.'}</h2>
    <p className="order-reference">{result.reference}</p>
    {result.lines ? <ul className="order-lines">{result.lines.map(line => <li key={line.itemId}>{line.image && <img src={line.image} alt="" width={52} height={60} />}<span>{line.title}{line.productNumber && <small>{line.productNumber}</small>}</span><strong>{line.pricePending ? 'Prijs te bevestigen' : money(line.priceCents)}</strong></li>)}</ul> : <p>{result.title}</p>}
    <div className="reservation-local">E-mailverzending volgt later. Er is geen e-mail verstuurd. {result.paymentPending ? 'Bewaar je privélink.' : 'Bewaar je privélink en de betaalgegevens hieronder.'}</div>
    {statusError && <p className="reservation-error" role="alert">{statusError}</p>}
    {active && result.paymentPending && <><p>Je selectie is ontvangen en de objecten zijn tijdelijk voor je gereserveerd tot <strong>{dateTime(result.deadline)}</strong>.</p><p>{result.pricePending ? 'Katrien bevestigt nog de prijs en de betaalafspraak.' : 'Katrien zet de betaalafspraak nog klaar.'} Je e-mailadres is bij je reservering opgeslagen. Maak nog niets over.</p><p>Wanneer e-mailverzending is aangesloten, kunnen de betaalinstructies met het rekeningnummer naar dat adres worden gestuurd. Na bevestiging van je betaling zijn de objecten definitief verkocht en klaar voor ophaling.</p></>}
    {active && !paid && !result.paymentPending && !statusError && <><p>Je objecten zijn tijdelijk voor je gereserveerd tot <strong>{dateTime(result.deadline)}</strong>. Je betaalt buiten de website. Katrien bevestigt de ontvangst en zet je objecten voor je klaar.</p><dl className="reservation-facts"><div><dt>Totaal</dt><dd>{money(result.priceCents)}</dd></div><div><dt>Nog te betalen</dt><dd>{money(Math.max(0, result.priceCents - result.paidCents))}</dd></div><div><dt>Begunstigde</dt><dd>{result.bank.beneficiary}</dd></div><div><dt>IBAN</dt><dd>{result.bank.iban}</dd></div><div><dt>Mededeling</dt><dd>{result.reference}</dd></div><div><dt>Betaal uiterlijk</dt><dd>{dateTime(result.deadline)}</dd></div></dl><button className="text-link" onClick={async () => { try { await navigator.clipboard.writeText(`${result.bank.iban}\n${result.reference}\n${money(Math.max(0, result.priceCents - result.paidCents))}`); setCopied(true); } catch { setCopied(false); } }}>{copied ? 'Betaalgegevens gekopieerd' : 'Kopieer betaalgegevens'}{copied ? <Check size={16} /> : <Copy size={16} />}</button><p>{result.bank.instructions}</p></>}
    {active && paid && <p>Je objecten staan voor je klaar. {result.fulfilment === 'pickup_arranged' ? 'Het ophalen is afgesproken.' : 'Katrien spreekt het ophalen met je af.'}</p>}
    {result.status === 'completed' && <p>Je objecten zijn overgedragen. Veel plezier met je vondsten.</p>}
    {(result.status === 'cancelled' || result.status === 'expired') && <p>Maak geen bedrag meer over. {result.status === 'expired' && 'De objecten kunnen opnieuw beschikbaar zijn. '}Heb je al overgeschreven? Neem contact op met Katrien zodat ze dit kan nakijken.</p>}
    {url && <a className="text-link order-private-link" href={url}>Bewaar je privé-bestellink<ArrowUpRight size={16} /></a>}
  </div>;
}

export type SelectionObject = CollectionObject & { missing?: boolean };
export type CheckoutDraft = { name: string; email: string; phone: string; message: string };
type CheckoutPayload = { items: { itemId: string; expectedPrice: number | null; expectedVersion: number }[]; contact: { name: string; email: string; phone: string; channel: 'email' }; message: string; termsVersion: string; accepted: boolean; website: string };
export type CheckoutAttempt = { fingerprint: string; key: string; payload: CheckoutPayload; unconfirmed: boolean; measurement?: Awaited<ReturnType<typeof heartOrderContext>>; measurementReady?: boolean };
export const canOrder = (object: CollectionObject) => (!!object.version || /^[KGH]\d{3}$/.test(object.id)) && object.availability !== 'reserved' && object.availability !== 'sold';
export function SelectionDialog({ objects, settings, onClose, onRemove, onOpen, onOrdered, onRefresh, draft, onDraft, attempt }: { objects: SelectionObject[]; settings: PublicSettings | null; onClose: () => void; onRemove: (id: string) => void; onOpen: (object: CollectionObject) => void; onOrdered: (ids: string[]) => void; onRefresh: () => void; draft: CheckoutDraft; onDraft: (draft: CheckoutDraft) => void; attempt: { current: CheckoutAttempt | null } }) {
  const [step, setStep] = useState<'selection' | 'details'>('selection');
  const [quote, setQuote] = useState<{ items: CollectionObject[]; termsVersion: string } | null>(null);
  const [result, setResult] = useState<ReservationResult | null>(null);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(!!attempt.current?.unconfirmed);
  const heading = useRef<HTMLHeadingElement>(null);
  const sending = useRef(false);
  const blocked = objects.some(object => object.missing || !canOrder(object));
  const pricePending = objects.some(object => !object.priceCents);
  const total = objects.reduce((sum, object) => sum + (canOrder(object) ? object.priceCents || 0 : 0), 0);
  useEffect(() => { heading.current?.focus(); }, [step, result]);
  const changed = !quote || quote.termsVersion !== settings?.termsVersion || quote.items.length !== objects.length || quote.items.some((item, index) => item.id !== objects[index]?.id || item.version !== objects[index]?.version || item.priceCents !== objects[index]?.priceCents || !canOrder(objects[index]));
  async function sendAttempt(pending: CheckoutAttempt) {
    if (sending.current) return;
    sending.current = true; setError(''); setBusy(true);
    try {
      if (!pending.measurementReady) { pending.measurement = await heartOrderContext(); pending.measurementReady = true; }
      // Retain the exact request until the server has given a definitive answer.
      // A catalogue refresh may already show these objects as reserved by this request.
      pending.unconfirmed = true;
      const response = await fetch('/api/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...pending.payload, key: pending.key, measurement: pending.measurement }), signal: AbortSignal.timeout(20000) });
      const body = await response.json();
      if (!response.ok) { if (response.status < 500 && response.status !== 429) pending.unconfirmed = false; if (response.status === 409) { setStep('selection'); onRefresh(); } throw new Error(body.error); }
      pending.unconfirmed = false; attempt.current = null;
      setResult(body); onOrdered(pending.payload.items.map(item => item.itemId));
    } catch (e) { setError((e as Error).name === 'TimeoutError' ? 'De bevestiging duurt te lang. Probeer opnieuw; dezelfde bestelling wordt veilig opgehaald zonder dubbel te bestellen.' : (e as Error).message || 'Bestellen is niet gelukt. Probeer opnieuw. Je selectie blijft bewaard.'); }
    finally { setUncertain(pending.unconfirmed); setBusy(false); sending.current = false; }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!settings || settings.acceptsReservations === false || !quote || changed || busy || uncertain) return;
    const f = new FormData(event.currentTarget);
    const payload: CheckoutPayload = { items: quote.items.map(object => ({ itemId: object.id, expectedPrice: object.priceCents || null, expectedVersion: object.version || 1 })), contact: { name: String(f.get('name') || ''), email: String(f.get('email') || ''), phone: String(f.get('phone') || ''), channel: 'email' }, message: String(f.get('message') || ''), termsVersion: quote.termsVersion, accepted: f.has('accepted'), website: String(f.get('website') || '') };
    const fingerprint = JSON.stringify(payload);
    if (!attempt.current || attempt.current.fingerprint !== fingerprint) attempt.current = { fingerprint, key: crypto.randomUUID(), payload, unconfirmed: false };
    await sendAttempt(attempt.current);
  }
  return <Dialog title={result ? 'Reservering ontvangen' : 'Mijn selectie'} onClose={onClose} dismissible={!busy} className="selection-dialog cart-dialog">
    {result ? <><ReservationConfirmation result={result} /><button className="primary-button" onClick={onClose}>Verder kijken<ArrowUpRight size={17} /></button></> : <>
      {step === 'details' && <button className="cart-back text-link" onClick={() => { setStep('selection'); setError(''); }}><ArrowLeft size={16} />Terug naar je selectie</button>}
      <h2 ref={heading} tabIndex={-1}>{step === 'selection' ? 'Mijn selectie' : 'Je selectie reserveren'}</h2>
      <p className="selection-subtitle">{objects.length ? `${objects.length} ${objects.length === 1 ? 'object' : 'objecten'} met een volgend hoofdstuk.` : 'Een mooie vondst begint met een hartje.'}</p>
      {objects.length ? <ul className="saved-list cart-list">{objects.map(object => <li key={object.id}>
        <button className="cart-object" onClick={() => onOpen(object)} disabled={busy || uncertain || !object.image} aria-label={`Bekijk ${object.title}`}>
          {object.image && <img src={object.image} alt="" width={64} height={74} />}<span><strong>{object.title}</strong><small>{object.missing ? 'Niet meer beschikbaar in de collectie' : object.availability === 'reserved' ? 'Gereserveerd · niet bestelbaar' : object.availability === 'sold' ? 'Verkocht · niet bestelbaar' : !object.priceCents ? 'Beschikbaar voor reservering' : 'Beschikbaar'}</small></span>
        </button><div className="cart-price">{object.priceCents ? money(object.priceCents) : 'Prijs te bevestigen'}</div>
        {step === 'selection' && <button className="icon-button" disabled={busy || uncertain} aria-label={`${object.title} verwijderen`} onClick={() => onRemove(object.id)}><X size={18} /></button>}
      </li>)}</ul> : <div className="empty-selection"><Heart size={32} strokeWidth={1.2} /><p>Tik op een hartje bij een object.<br />Je vindt het hier terug.</p><button className="text-link" onClick={onClose}>Ontdek de collectie<ArrowUpRight size={16} /></button></div>}
      {error && <p className="reservation-error" role="alert">{error}</p>}
      {uncertain && <div className="cart-actions"><p role="status">Je eerdere aanvraag is mogelijk al ontvangen. Haal eerst de bevestiging van diezelfde aanvraag op.</p><button type="button" className="primary-button" disabled={busy} onClick={() => { if (attempt.current) void sendAttempt(attempt.current); }}>{busy ? 'Bevestiging ophalen…' : 'Bevestiging opnieuw ophalen'}<ArrowUpRight size={17} /></button></div>}
      {objects.length > 0 && <div className="cart-total"><span>Totaal</span><strong>{pricePending ? 'Wordt bevestigd' : money(total)}</strong></div>}
      {step === 'selection' && objects.length > 0 && !uncertain && <div className="cart-actions">
        {blocked && <p className="cart-explanation">Niet alle objecten zijn beschikbaar. Verwijder de gereserveerde, verkochte of verwijderde objecten om verder te gaan.</p>}
        {!blocked && !settings && <p className="cart-explanation">De actuele beschikbaarheid wordt opgehaald. Probeer zo opnieuw; je selectie blijft bewaard.</p>}
        <button className="primary-button" disabled={blocked || !settings || settings.acceptsReservations === false || objects.length > 50} onClick={() => { setQuote({ items: objects.map(object => ({ ...object })), termsVersion: settings!.termsVersion }); setStep('details'); setError(''); }}>Verder naar reserveren<ArrowUpRight size={18} /></button>
        {settings?.acceptsReservations === false && <p className="cart-explanation">Nieuwe reserveringen zijn tijdelijk gesloten. Je selectie blijft bewaard.</p>}
        {objects.length > 50 && <p>Je kunt maximaal 50 objecten samen bestellen.</p>}
        <p className="cart-explanation">Laat je selectie tijdelijk reserveren. Je betaalt later via overschrijving. Na bevestiging van de betaling staan de objecten klaar voor ophaling.</p>
        <button className="text-link" onClick={onClose}>Verder kijken<ArrowUpRight size={16} /></button>
      </div>}
      <form hidden={step !== 'details' || uncertain} className="enquiry-form checkout-form" onChange={event => { const f = new FormData(event.currentTarget); onDraft({ name: String(f.get('name') || ''), email: String(f.get('email') || ''), phone: String(f.get('phone') || ''), message: String(f.get('message') || '') }); }} onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>Naam<input defaultValue={draft.name} name="name" required minLength={2} maxLength={120} autoComplete="name" /></label>
          <label>E-mailadres<span id="checkout-email-help" className="checkout-email-help">Voor de opvolging en betaalinstructies van je reservering.</span><input aria-label="E-mailadres" aria-describedby="checkout-email-help" defaultValue={draft.email} name="email" required type="email" maxLength={180} autoComplete="email" /></label>
          <details className="checkout-optional"><summary>Iets toevoegen? (optioneel)</summary><label>Telefoon <span>(optioneel)</span><input defaultValue={draft.phone} name="phone" type="tel" maxLength={40} autoComplete="tel" /></label>
          <label>Bericht <span>(optioneel)</span><textarea defaultValue={draft.message} name="message" rows={3} maxLength={3000} /></label></details>
          <div className="reservation-honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" defaultValue="" /></label></div>
          <p className="cart-explanation">Je selectie wordt {settings?.deadlineDays || 3} dagen tijdelijk gereserveerd. {pricePending || !settings?.ready ? 'Katrien bevestigt eerst de prijs en de betaalafspraak. Je hoeft nu nog niets te betalen.' : 'De betaalgegevens staan na het afronden op je bevestiging. Je betaalt via overschrijving.'} Na bevestiging van de volledige betaling zijn de objecten verkocht en klaar voor ophaling.</p>
          <p className="cart-explanation">{settings?.pickup}</p>
          <LegalLinks newTab />
          <label className="reservation-checkbox"><input name="accepted" type="checkbox" required /><span>Ik wil deze selectie laten reserveren.</span></label>
          <p className="cart-explanation">E-mailverzending volgt later. Bewaar na het afronden je privélink. Je ontvangt nu nog geen automatische e-mail.</p>
          {changed && <p className="reservation-error" role="alert">Je selectie of de bestelafspraken zijn gewijzigd. Ga terug naar je selectie en bekijk de actuele gegevens.</p>}
          <button className="primary-button" disabled={busy || changed || !settings || settings.acceptsReservations === false}>{busy ? 'Je selectie reserveren…' : 'Laat mijn selectie reserveren'}<ArrowUpRight size={17} /></button>
        </fieldset>
      </form>
    </>}
  </Dialog>;
}
