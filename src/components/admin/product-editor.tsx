'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, Check, CheckCheck, ChevronDown, ClipboardPaste, Copy, GripVertical, ImagePlus, LoaderCircle, LockKeyhole, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { categories, type Category } from '@/lib/collection';
import { availability, money, type AdminStore, type Item, type Photo } from '@/lib/backend/types';
import { divideText, inputCents, materialGroups, materialName, missingFields, textTargets, type MaterialGroup, type TextTarget } from '@/lib/inventory';

type Draft = { title: string; description: string; date: string; dimensions: string; condition: string; price: string; maker: string; material: string; materialGroup: MaterialGroup | ''; category: Category; publication: Item['publication']; photos: Photo[]; editorReady: boolean };
type PendingPhoto = { key: string; file: File; preview: string; state: 'waiting' | 'uploading' | 'error'; error?: string };
type SaveState = 'idle' | 'saving' | 'saved' | 'error';
const fromItem = (item?: Item): Draft => ({ title: item?.title || '', description: item?.description || '', date: item?.date || '', dimensions: item?.dimensions || '', condition: item?.condition || '', price: item && !item.priceUnset ? (item.priceCents / 100).toLocaleString('nl-BE', { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '', maker: item?.maker || '', material: item?.material || '', materialGroup: item?.materialGroup || '', category: item?.category || 'objecten', publication: item?.publication || 'draft', photos: item?.photos || [], editorReady: item?.editorReady || false });
const asItem = (draft: Draft) => ({ ...draft, materialGroup: draft.materialGroup || undefined, priceCents: inputCents(draft.price) || 0, priceUnset: draft.price.trim() === '' });
function EditorField({ id, label, hint, children, wide = false }: { id: string; label: string; hint?: string; children: ReactNode; wide?: boolean }) { return <div className={`pe-field ${wide ? 'pe-wide' : ''}`}><label htmlFor={`product-${id}`}>{label}</label>{children}{hint && <p className="pe-hint" id={`hint-${id}`}>{hint}</p>}</div>; }

export function ProductEditor({ item, store, onDirect, onData, onBack, onNext, registerLeave }: { item?: Item; store: AdminStore; onDirect: (itemId: string, customerId: string) => Promise<void>; onData: (store: AdminStore) => void; onBack: () => void; onNext: () => void; registerLeave: (handler: (() => Promise<boolean>) | null) => void }) {
  const [draft, setDraft] = useState<Draft>(() => fromItem(item));
  const [creationKey] = useState(() => crypto.randomUUID());
  const [serverItem, setServerItem] = useState(item);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState(item?.updatedAt || '');
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState<Item | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [recovery, setRecovery] = useState<{ draft: Draft; creationKey: string } | null>(null);
  const [recoveredKey, setRecoveredKey] = useState<string>();
  const [recoveryWarning, setRecoveryWarning] = useState('');
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [dragPhoto, setDragPhoto] = useState<string | null>(null);
  const [dropPhoto, setDropPhoto] = useState<string | null>(null);
  const [removed, setRemoved] = useState<{ photo: Photo; index: number } | null>(null);
  const [showText, setShowText] = useState(false);
  const [showCheck, setShowCheck] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [directBusy, setDirectBusy] = useState(false);
  const [correctMaterial, setCorrectMaterial] = useState<MaterialGroup | ''>('');
  const [correcting, setCorrecting] = useState(false);
  const [feedback, setFeedback] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const latest = useRef(draft); latest.current = draft;
  const meta = useRef(item);
  const dataCallback = useRef(onData); dataCallback.current = onData;
  const queue = useRef<PendingPhoto[]>([]);
  const uploading = useRef(false);
  const alive = useRef(true);
  const flight = useRef<Promise<boolean> | null>(null);
  const retryPhotosOnly = useRef(false);
  const saved = useRef(JSON.stringify(fromItem(item)));
  const blocked = useRef(false);
  const recoveryKey = `lothuus:product:${item?.id || 'new'}`;
  const creation = useRef(creationKey); creation.current = recoveredKey || creationKey;
  const missing = missingFields(asItem(draft));
  const dirty = JSON.stringify(draft) !== saved.current;
  const hasPending = pending.length > 0;

  useEffect(() => { alive.current = true; return () => { alive.current = false; queue.current.forEach(p => URL.revokeObjectURL(p.preview)); }; }, []);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(recoveryKey);
      if (raw) {
        const value = JSON.parse(raw);
        if (value?.draft && textTargets.every(t => typeof value.draft[t.key] === 'string') && typeof value.draft.title === 'string' && Array.isArray(value.draft.photos) && typeof value.creationKey === 'string') setRecovery(value);
      }
    } catch { setRecoveryWarning('Je browser kan geen herstelkopie bewaren. Laat deze pagina open tot alles is opgeslagen.'); }
  }, [recoveryKey]);
  useEffect(() => {
    if (!dirty) return;
    try { localStorage.setItem(recoveryKey, JSON.stringify({ draft, creationKey: creation.current })); }
    catch { setRecoveryWarning('De herstelkopie kan niet worden bijgewerkt. Bewaar je wijzigingen vóór je afsluit.'); }
  }, [draft, dirty, recoveryKey]);
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => { if (JSON.stringify(latest.current) !== saved.current || uploading.current || queue.current.length) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, []);

  const save = useCallback(async (manual = false, photosOnly = false): Promise<boolean> => {
    // Photo saves and whole-fiche saves share one queue and the latest server version.
    while (flight.current) { const ok = await flight.current; if (!ok && !photosOnly) return false; }
    const hasChanges = () => photosOnly && meta.current
      ? JSON.stringify(latest.current.photos) !== JSON.stringify((JSON.parse(saved.current) as Draft).photos)
      : JSON.stringify(latest.current) !== saved.current;
    if (!alive.current) return false;
    if (!hasChanges()) return true;
    if ((!photosOnly || !meta.current) && !latest.current.materialGroup) { if (manual) setError('Kies eerst een materiaal. Daarna bewaren we je concept automatisch.'); return false; }
    if (blocked.current && !manual && !photosOnly) return false;
    blocked.current = false;
    const run = async () => {
      retryPhotosOnly.current = photosOnly;
      setSaveState('saving'); setError('');
      try {
        while (hasChanges()) {
          const snapshot = latest.current;
          const photoSave = photosOnly && !!meta.current;
          const cents = inputCents(snapshot.price);
          if (!photoSave && Number.isNaN(cents)) throw new Error('Controleer de prijs. Gebruik bijvoorbeeld 45 of 45,50.');
          const photos = snapshot.photos.map((p, index) => ({ ...p, alt: p.alt.trim() || `Productfoto ${index + 1}` }));
          const payload = { ...snapshot, photos, materialGroup: snapshot.materialGroup || undefined, priceCents: cents ?? 0, priceUnset: cents === null, id: meta.current?.id, version: meta.current?.version, creationKey: meta.current?.creationKey || creation.current };
          const response = await fetch('/api/store', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(photoSave ? { action: 'save-item-photos', id: meta.current!.id, version: meta.current!.version, photos } : { action: 'save-item', item: payload }) });
          const result = await response.json();
          if (!response.ok) {
            if (response.status === 401) { setSessionExpired(true); throw new Error('Je sessie is verlopen. Log hieronder opnieuw in; je invoer blijft behouden.'); }
            if (response.status === 409 && meta.current?.id) {
              const currentResponse = await fetch('/api/store', { cache: 'no-store' });
              if (currentResponse.ok) { const currentStore = await currentResponse.json() as AdminStore; const currentItem = currentStore.items.find(i => i.id === meta.current?.id); if (currentItem && currentItem.version !== meta.current.version) setConflict(currentItem); }
            }
            throw new Error(result.error || 'Bewaren is niet gelukt. Je invoer blijft hier staan.');
          }
          const store = result as AdminStore;
          const record = store.items.find(i => i.id === meta.current?.id || i.creationKey === creation.current);
          if (!record) throw new Error('De opslag kon niet worden bevestigd. Probeer opnieuw.');
          // A retry after a lost create response may return the original revision.
          meta.current = record;
          if (alive.current) { setServerItem(record); dataCallback.current(store); }
          if (photoSave) {
            // A photo save confirms only the photos; keep unfinished text dirty.
            const baseline = JSON.parse(saved.current) as Draft;
            saved.current = JSON.stringify({ ...baseline, photos: snapshot.photos });
            continue;
          }
          const returned = JSON.stringify(fromItem(record));
          saved.current = returned === JSON.stringify(snapshot) ? JSON.stringify(snapshot) : returned;
          if (record.version === 1 && returned !== JSON.stringify(snapshot)) continue;
          saved.current = JSON.stringify(snapshot);
        }
        if (JSON.stringify(latest.current) === saved.current) {
          try { localStorage.removeItem(recoveryKey); } catch { /* Server has confirmed the save. */ }
        }
        if (alive.current) { setSaveState('saved'); setSavedAt(new Date().toISOString()); }
        return true;
      } catch (e) {
        blocked.current = true;
        if (alive.current) { setSaveState('error'); setError(e instanceof TypeError ? 'De verbinding is onderbroken. Je invoer blijft behouden. Probeer opnieuw zodra je verbinding terug is.' : (e as Error).message); }
        return false;
      }
    };
    flight.current = run();
    try { return await flight.current; } finally { flight.current = null; }
  }, [recoveryKey]);

  useEffect(() => { if (!dirty || !draft.materialGroup || recovery) return; const timer = setTimeout(() => { void save(); }, 1100); return () => clearTimeout(timer); }, [draft, dirty, save, recovery]);
  useEffect(() => {
    registerLeave(async () => {
      if (uploading.current || queue.current.length) { setError('Rond de foto-uploads af of verwijder de mislukte uploads vóór je verdergaat.'); return false; }
      if (JSON.stringify(latest.current) === saved.current) return true;
      if (await save(true)) return true;
      return window.confirm('Je wijzigingen zijn nog niet op de server bewaard. Wil je deze pagina toch verlaten? Een herstelkopie blijft in deze browser staan.');
    });
    return () => registerLeave(null);
  }, [registerLeave, save]);

  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    setFeedback(''); setError(''); blocked.current = false;
    const next = { ...latest.current, [key]: value };
    if (next.editorReady && missingFields(asItem(next)).length) next.editorReady = false;
    latest.current = next;
    setDraft(next);
  }
  const updatePhotos = (photos: Photo[]) => change('photos', photos);
  const updateQueue = () => { if (alive.current) setPending([...queue.current]); };
  async function processQueue() {
    if (uploading.current) return;
    uploading.current = true;
    while (alive.current) {
      const next = queue.current.find(p => p.state === 'waiting');
      if (!next) break;
      next.state = 'uploading'; updateQueue();
      try {
        const body = new FormData(); body.append('file', next.file);
        const response = await fetch('/api/images', { method: 'POST', body });
        const photo = await response.json();
        if (!response.ok) throw new Error(photo.error || 'Deze foto kon niet worden verwerkt.');
        if (!alive.current) break;
        updatePhotos([...latest.current.photos, photo]);
        queue.current = queue.current.filter(p => p.key !== next.key);
        URL.revokeObjectURL(next.preview);
      } catch (e) { next.state = 'error'; next.error = (e as Error).message; }
      updateQueue();
    }
    uploading.current = false;
  }
  function addFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    if (latest.current.photos.length + queue.current.length + list.length > 8) { setError('Je kunt maximaal 8 foto’s gebruiken. Kies minder bestanden of verwijder eerst een foto.'); return; }
    const unsupported = list.find(f => !/\.(jpe?g|png|webp|avif)$/i.test(f.name) || f.size > 15000000);
    if (unsupported) { setError(`${unsupported.name}: kies JPEG, PNG, WebP of AVIF van maximaal 15 MB.`); return; }
    queue.current.push(...list.map(file => ({ key: crypto.randomUUID(), file, preview: URL.createObjectURL(file), state: 'waiting' as const })));
    setError(''); updateQueue(); void processQueue();
  }
  function reorder(from: string, to: string) {
    const photos = [...latest.current.photos]; const start = photos.findIndex(p => p.id === from); const end = photos.findIndex(p => p.id === to);
    if (start < 0 || end < 0 || start === end) return;
    photos.splice(end, 0, photos.splice(start, 1)[0]);
    updatePhotos(photos);
    void save(false, true).then(ok => { if (ok && alive.current) setFeedback('Fotovolgorde opgeslagen. De eerste foto is de hoofdfoto.'); });
  }
  function focusField(field: string) { const target = document.getElementById(`product-${field}`); target?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' }); target?.focus({ preventScroll: true }); }
  async function finish(next = false) {
    if (hasPending) { setError('Wacht tot alle foto’s verwerkt zijn of verwijder de mislukte uploads.'); return; }
    if (await save(true)) { if (next) onNext(); else setFeedback('Je product is bewaard. Je kunt later altijd verder werken.'); }
  }
  async function markReady() {
    setShowCheck(true);
    if (missing.length || hasPending) { if (missing[0]) focusField(missing[0].field); return; }
    change('editorReady', true);
    // Commit the exact state synchronously; React may not have rendered it yet.
    latest.current = { ...latest.current, editorReady: true };
    if (await save(true)) setFeedback('Helemaal klaar. Je product blijft privé tot je het zelf publiceert.');
  }
  async function correctMaterialGroup() {
    if (!correctMaterial) return;
    setCorrecting(true);
    if (!await save(true) || !meta.current) { setCorrecting(false); return; } setError('');
    try {
      const response = await fetch('/api/store', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'change-material', id: meta.current.id, version: meta.current.version, materialGroup: correctMaterial }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Het materiaal kon niet worden gecorrigeerd.');
      const record = (result as AdminStore).items.find(i => i.id === meta.current!.id)!;
      meta.current = record;
      const next = { ...latest.current, materialGroup: record.materialGroup || '' } as Draft;
      latest.current = next; saved.current = JSON.stringify(fromItem(record)); setDraft(next); setServerItem(record); dataCallback.current(result); setCorrectMaterial(''); setSaveState('saved'); setSavedAt(record.updatedAt || ''); setFeedback(`Materiaal gecorrigeerd. Het nieuwe nummer is ${record.productNumber}. Je vorige nummer blijft in de geschiedenis.`);
    } catch (e) { setError((e as Error).message); }
    finally { setCorrecting(false); }
  }
  async function copyText() {
    const text = [draft.title, draft.description, `Stijl / Periode: ${draft.date}`, `Afmetingen: ${draft.dimensions}`, `Staat: ${draft.condition}`, `Vaste Lothuus-prijs: ${draft.price ? money(inputCents(draft.price) || 0) : 'Nog in te vullen'}`].filter(Boolean).join('\n\n');
    try { await navigator.clipboard.writeText(text); setFeedback('Producttekst gekopieerd.'); } catch { setError('Kopiëren is niet gelukt. Selecteer de tekst en kopieer met je toetsenbord.'); }
  }

  return <div className="product-workspace">
    <div className="pe-topbar"><button className="a-back" onClick={onBack}><ArrowLeft size={16} />Alle producten</button><div className={`pe-save-state ${saveState === 'error' ? 'is-error' : ''}`} role="status">{saveState === 'saving' ? <LoaderCircle size={15} className="a-spin" /> : saveState === 'error' ? <RotateCcw size={15} /> : <Check size={15} />}<span>{saveState === 'saving' ? 'Wijzigingen bewaren…' : saveState === 'error' ? 'Nog niet bewaard' : dirty ? 'Wijzigingen klaar om te bewaren' : savedAt ? `Opgeslagen om ${new Intl.DateTimeFormat('nl-BE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' }).format(new Date(savedAt))}` : 'Begin waar je wilt'}</span>{saveState === 'error' && <button onClick={() => void save(true, retryPhotosOnly.current)}>Opnieuw proberen</button>}</div></div>
    {recovery && <div className="pe-recovery"><div><strong>Er staat nog invoer in deze browser.</strong><p>Herstel je vorige wijzigingen of ga verder met de opgeslagen versie.</p></div><button className="a-secondary" onClick={() => { setDraft(recovery.draft); latest.current = recovery.draft; setRecoveredKey(recovery.creationKey); setRecovery(null); blocked.current = false; }}>Invoer herstellen</button><button className="a-link" onClick={() => { localStorage.removeItem(recoveryKey); setRecovery(null); }}>Opgeslagen versie houden</button></div>}
    {sessionExpired && <form className="pe-session" onSubmit={async event => { event.preventDefault(); const form = event.currentTarget; const password = new FormData(form).get('password'); setLoginBusy(true); setError(''); try { const response = await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password, email: 'katrien@lothuus.be' }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Inloggen is niet gelukt.'); form.reset(); setSessionExpired(false); await save(true, retryPhotosOnly.current); } catch (e) { setError((e as Error).message); } finally { setLoginBusy(false); } }}><div><h2>Even opnieuw inloggen</h2><p>Je invoer blijft op deze pagina staan. Na het inloggen bewaren we verder.</p></div><label htmlFor="renew-password">Je wachtwoord<input id="renew-password" type="password" name="password" autoComplete="current-password" required maxLength={200} /></label><button className="a-button" disabled={loginBusy}>{loginBusy ? 'Inloggen…' : 'Inloggen en bewaren'}</button></form>}
    {conflict && <section className="pe-conflict" aria-label="Gewijzigd in een ander venster"><h2>Dit product is ook in een ander venster gewijzigd.</h2><p>Je eigen invoer blijft hier staan. Vergelijk de versies en kies welke je wilt bewaren.</p><div className="pe-conflict-versions">{[{ label: 'Jouw invoer', value: draft }, { label: 'Opgeslagen versie', value: fromItem(conflict) }].map(version => <div key={version.label}><h3>{version.label}</h3><dl>{textTargets.map(target => <div key={target.key}><dt>{target.label}</dt><dd>{version.value[target.key] || 'Nog leeg'}</dd></div>)}<div><dt>Foto’s</dt><dd>{version.value.photos.length} foto’s, in volgorde: {version.value.photos.map(p => p.alt).join(', ')}</dd></div></dl></div>)}</div><div className="a-actions"><button className="a-secondary" type="button" onClick={() => { const value = fromItem(conflict); meta.current = conflict; saved.current = JSON.stringify(value); latest.current = value; setDraft(value); setServerItem(conflict); setSavedAt(conflict.updatedAt || conflict.createdAt); setConflict(null); setError(''); setSaveState('saved'); blocked.current = false; try { localStorage.removeItem(recoveryKey); } catch {} }}>Opgeslagen versie gebruiken</button><button className="a-button" type="button" onClick={() => { meta.current = conflict; setConflict(null); void save(true); }}>Bewaren met mijn invoer</button></div></section>}
    {recoveryWarning && <p className="a-info" role="status">{recoveryWarning}</p>}
    {error && <div className="a-error pe-message" role="alert"><span>{error}</span><button type="button" aria-label="Melding sluiten" onClick={() => setError('')}><X size={16} /></button></div>}
    {feedback && <div className="a-notice pe-message" role="status"><Check size={16} /><span>{feedback}</span></div>}
    <div className="pe-layout"><form ref={formRef} className="pe-form" aria-busy={correcting} onSubmit={(event: FormEvent) => { event.preventDefault(); void finish(); }}><fieldset className="pe-fieldset" disabled={correcting}>
      <section className="pe-section" aria-labelledby="material-heading"><div className="pe-section-title"><div><h2 id="material-heading">Een plek in je collectie</h2><p>Kies het materiaal. Het productnummer regelen wij.</p></div>{serverItem?.productNumber && <span className="pe-number">{serverItem.productNumber}<LockKeyhole size={13} /></span>}</div>
        {serverItem?.sourceReference && <p className="pe-hint">Overgezet uit fotomap {serverItem.sourceReference}.{(serverItem.sourcePhotoCount || 0) > 8 ? ` De eerste 8 van ${serverItem.sourcePhotoCount} foto’s staan op deze fiche. Alle foto’s blijven bewaard in de oorspronkelijke fotocollectie en het importarchief.` : ' Je kunt de voorlopige titel hieronder aanpassen.'}</p>}
        <div className="pe-materials" id="product-materialGroup" tabIndex={-1} role="group" aria-label="Materiaalgroep">{materialGroups.map(group => <button key={group.code} type="button" aria-pressed={draft.materialGroup === group.code} disabled={Boolean(serverItem?.productNumber) && draft.materialGroup !== group.code} title={group.hint} onClick={() => { change('materialGroup', group.code); if (!serverItem?.productNumber) change('category', group.category); }}><span className="pe-material-code">{group.code}</span><span>{group.label}</span>{draft.materialGroup === group.code && <Check size={14} />}</button>)}</div>
        <p className="pe-hint">{serverItem?.productNumber ? `Nummer ${serverItem.productNumber} blijft bij dit product, ook na verkoop.` : draft.materialGroup ? `Je krijgt automatisch het volgende vrije ${draft.materialGroup}-nummer bij het bewaren.` : 'Keramiek, glas of iets anders? Je kunt de overige details alvast invullen.'}</p>
        {serverItem?.productNumber && availability(store, serverItem.id) === 'available' && <details className="pe-material-correction"><summary>Verkeerd materiaal gekozen?</summary><p>Een correctie geeft dit product een nieuw nummer in de juiste reeks. Het vorige nummer blijft gereserveerd en wordt nooit hergebruikt.</p><div><select aria-label="Gecorrigeerde materiaalgroep" value={correctMaterial} onChange={e => setCorrectMaterial(e.target.value as MaterialGroup)} disabled={correcting}><option value="">Kies het juiste materiaal</option>{materialGroups.filter(m => m.code !== draft.materialGroup).map(m => <option key={m.code} value={m.code}>{m.label}</option>)}</select><button type="button" className="a-secondary" disabled={!correctMaterial || correcting || hasPending} onClick={() => void correctMaterialGroup()}>{correcting ? 'Corrigeren…' : 'Materiaal corrigeren'}</button></div></details>}
        {serverItem?.previousNumbers?.length ? <p className="pe-hint">Vorige nummers: {serverItem.previousNumbers.join(', ')}. Alleen het huidige nummer gebruiken.</p> : null}
      </section>
      <section className="pe-section" aria-labelledby="photos-heading"><div className="pe-section-title"><div><h2 id="photos-heading">Laat het product zien <span className="pe-count">{draft.photos.length} / 8</span></h2><p>Kies je hoofdfoto of versleep de foto’s. De volgorde wordt meteen opgeslagen, ook als de fiche nog niet volledig is.</p></div></div>
        <div id="product-photos" tabIndex={-1} className={`pe-photo-workspace ${dragOver ? 'is-file-over' : ''}`} onDragOver={e => { e.preventDefault(); if (e.dataTransfer.types.includes('Files')) setDragOver(true); }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }} onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}>
          {(draft.photos.length > 0 || pending.length > 0) && <div className="pe-photo-grid">{draft.photos.map((photo, index) => <div className={`pe-photo ${dragPhoto === photo.id ? 'is-dragging' : ''} ${dropPhoto === photo.id && dragPhoto !== photo.id ? 'is-target' : ''}`} data-photo-id={photo.id} key={photo.id} draggable onDragStart={e => { e.dataTransfer.setData('text/plain', photo.id); e.dataTransfer.effectAllowed = 'move'; setDragPhoto(photo.id); }} onDragOver={e => { if (dragPhoto) { e.preventDefault(); setDropPhoto(photo.id); } }} onDrop={e => { if (dragPhoto) { e.preventDefault(); e.stopPropagation(); reorder(dragPhoto, photo.id); setDragPhoto(null); setDropPhoto(null); } }} onDragEnd={() => { setDragPhoto(null); setDropPhoto(null); }}>
            <div className="pe-photo-image"><img src={`/api/images/${photo.id}?size=thumb`} alt={photo.alt} /><span className={`pe-photo-label ${index === 0 ? 'is-cover' : ''}`}>{index === 0 ? 'Hoofdfoto' : String(index + 1).padStart(2, '0')}</span><button type="button" className="pe-photo-remove" aria-label={`Foto ${index + 1} verwijderen`} onClick={() => { setRemoved({ photo, index }); updatePhotos(latest.current.photos.filter(p => p.id !== photo.id)); }}><X size={15} /></button></div>
            <div className="pe-photo-controls"><button type="button" className="pe-drag-handle" aria-label={`Foto ${index + 1} verslepen`} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); setDragPhoto(photo.id); }} onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) { const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-photo-id]'); setDropPhoto(target?.getAttribute('data-photo-id') || null); } }} onPointerUp={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) { const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-photo-id]')?.getAttribute('data-photo-id'); if (target) reorder(photo.id, target); e.currentTarget.releasePointerCapture(e.pointerId); } setDragPhoto(null); setDropPhoto(null); }} onPointerCancel={() => { setDragPhoto(null); setDropPhoto(null); }}><GripVertical size={17} /></button><span>Foto {index + 1}</span><button type="button" disabled={index === 0} aria-label={`Foto ${index + 1} eerder plaatsen`} onClick={() => reorder(photo.id, draft.photos[index - 1].id)}><ArrowLeft size={14} /></button><button type="button" disabled={index === draft.photos.length - 1} aria-label={`Foto ${index + 1} later plaatsen`} onClick={() => reorder(photo.id, draft.photos[index + 1].id)}><ArrowRight size={14} /></button></div>
            {index > 0 && <button type="button" className="pe-make-cover" aria-label={`Foto ${index + 1} als hoofdfoto instellen`} onClick={() => reorder(photo.id, latest.current.photos[0].id)}>Maak hoofdfoto</button>}
            <details className="pe-photo-alt"><summary>Fotobeschrijving</summary><input aria-label={`Beschrijving foto ${index + 1}`} maxLength={240} value={photo.alt} onChange={e => updatePhotos(latest.current.photos.map(p => p.id === photo.id ? { ...p, alt: e.target.value } : p))} onBlur={() => { if (!photo.alt.trim()) updatePhotos(latest.current.photos.map(p => p.id === photo.id ? { ...p, alt: `Productfoto ${index + 1}` } : p)); }} /></details>
          </div>)}{pending.map(p => <div className="pe-photo pe-pending" key={p.key}><div className="pe-photo-image"><img src={p.preview} alt={p.file.name} /><span className="pe-photo-label">{p.state === 'error' ? 'Niet gelukt' : 'Verwerken…'}</span></div><p>{p.state === 'error' ? p.error : p.file.name}</p>{p.state === 'error' ? <div className="pe-pending-actions"><button type="button" className="a-link" onClick={() => { p.state = 'waiting'; updateQueue(); void processQueue(); }}>Opnieuw</button><button type="button" aria-label={`Upload ${p.file.name} verwijderen`} onClick={() => { URL.revokeObjectURL(p.preview); queue.current = queue.current.filter(v => v.key !== p.key); updateQueue(); }}><X size={16} /></button></div> : <LoaderCircle className="a-spin" size={17} />}</div>)}
          {draft.photos.length + pending.length < 8 && draft.photos.length > 0 && <button className="pe-add-photo" type="button" onClick={() => fileInput.current?.click()}><ImagePlus size={23} /><span>Foto toevoegen</span></button>}</div>}
          {!draft.photos.length && !pending.length && <button className="pe-dropzone" type="button" onClick={() => fileInput.current?.click()}><span className="pe-upload-icon"><ImagePlus size={27} strokeWidth={1.4} /></span><strong>Sleep je foto’s hierheen</strong><span>of <u>kies foto’s op je computer</u></span><small>2 tot 8 foto’s · JPEG, PNG, WebP of AVIF · tot 15 MB per foto</small></button>}
          <input ref={fileInput} className="sr-only" tabIndex={-1} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple aria-label="Productfoto’s kiezen" onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
        </div>
        {removed && <div className="pe-undo" role="status"><span>Foto verwijderd uit de fiche.</span><button type="button" onClick={() => { if (latest.current.photos.length + queue.current.length >= 8) { setError('Maak eerst een fotoplaats vrij om deze foto terug te zetten.'); return; } const photos = [...latest.current.photos]; photos.splice(removed.index, 0, removed.photo); updatePhotos(photos); setRemoved(null); }}><RotateCcw size={14} />Ongedaan maken</button></div>}
        {draft.photos.length > 8 && <p className="a-info">Deze bestaande fiche heeft meer dan 8 foto’s. Ze blijven behouden. Kies maximaal 8 foto’s om de fiche als klaar te markeren.</p>}
      </section>
    {serverItem?.sourcePhotos && serverItem.sourcePhotos.some(photo => !draft.photos.some(p => p.id === photo.id)) && <section className="pe-section pe-import-photos"><details><summary>Andere foto’s uit deze fotomap</summary><p className="pe-hint">Alle aangeleverde foto’s blijven hier beschikbaar. {draft.photos.length >= 8 ? 'Haal eerst een foto van de fiche om plaats te maken; je kunt maximaal acht foto’s kiezen.' : 'Klik op een foto om deze achteraan aan je fiche toe te voegen.'}</p><div>{serverItem.sourcePhotos.filter(photo=>!draft.photos.some(p=>p.id===photo.id)).map(photo=><button key={photo.id} type="button" className="a-secondary" disabled={draft.photos.length >= 8} onClick={()=>change('photos',[...draft.photos,photo])}><img src={`/api/images/${photo.id}?size=thumb`} alt={photo.alt} loading="lazy" /><span>Aan fiche toevoegen</span></button>)}</div></details></section>}
      <section className="pe-section" aria-labelledby="story-heading"><div className="pe-section-title"><div><h2 id="story-heading">Het verhaal van je product</h2><p>Schrijf zelf of gebruik een tekst die je al hebt.</p></div><button type="button" className={`a-secondary pe-paste-trigger ${showText ? 'is-selected' : ''}`} aria-expanded={showText} aria-controls="pe-text-assistant" onClick={() => setShowText(!showText)}><ClipboardPaste size={16} />Bestaande tekst gebruiken</button></div>
        {showText && <TextAssistant draft={draft} onApply={fields => { const next = { ...latest.current, ...fields, editorReady: false }; latest.current = next; setDraft(next); blocked.current = false; setFeedback('Tekst verdeeld. Kijk de velden nog even na.'); }} />}
        <div className="pe-fields"><EditorField id="title" label="Titel" hint="Een korte, herkenbare naam voor dit product." wide><input id="product-title" value={draft.title} maxLength={180} placeholder="Bijvoorbeeld: groene vaas met druipglazuur" onChange={e => change('title', e.target.value)} /></EditorField><EditorField id="description" label="Beschrijving" wide><textarea id="product-description" rows={5} maxLength={6000} value={draft.description} placeholder="Wat maakt dit object bijzonder? Vertel over de vorm, het materiaal of een mooi detail." onChange={e => change('description', e.target.value)} /><span className="pe-character-count">{draft.description.length.toLocaleString('nl-BE')} / 6.000</span></EditorField></div>
      </section>
      <section className="pe-section" aria-labelledby="details-heading"><div className="pe-section-title"><div><h2 id="details-heading">De details</h2><p>Alles wat iemand graag wil weten vóór een aankoop.</p></div></div><div className="pe-fields"><EditorField id="date" label="Stijl / Periode" hint="Niet zeker? ‘Onbekend’ mag ook."><input id="product-date" value={draft.date} maxLength={120} placeholder="Bijvoorbeeld: jaren 70, art deco" onChange={e => change('date', e.target.value)} /></EditorField><EditorField id="dimensions" label="Afmetingen" hint="Vermeld de eenheid, bijvoorbeeld cm."><input id="product-dimensions" value={draft.dimensions} maxLength={180} placeholder="H 24 × B 12 cm" onChange={e => change('dimensions', e.target.value)} /></EditorField><EditorField id="condition" label="Staat" hint="Wees gerust precies over gebruikssporen. Voeg er ook een foto van toe." wide><textarea id="product-condition" rows={3} value={draft.condition} maxLength={1200} placeholder="Bijvoorbeeld: mooie vintage staat, kleine chip aan de onderrand." onChange={e => change('condition', e.target.value)} /></EditorField><EditorField id="price" label="Vaste Lothuus-prijs" hint={serverItem && serverItem.priceCents > 0 && serverItem.priceCents === asItem(draft).priceCents ? 'De vaste prijs voor dit product.' : 'Nog niet beslist? Laat dit gerust leeg in je concept.'}><div className="pe-price"><span>€</span><input id="product-price" disabled={Boolean(serverItem && availability(store, serverItem.id) !== 'available')} inputMode="decimal" value={draft.price} aria-invalid={Number.isNaN(inputCents(draft.price))} placeholder="0,00" maxLength={20} onChange={e => change('price', e.target.value)} onBlur={() => { const cents = inputCents(draft.price); if (cents !== null && !Number.isNaN(cents)) change('price', (cents / 100).toFixed(2).replace('.', ',')); }} /></div>{Number.isNaN(inputCents(draft.price)) && <p className="pe-field-error">Gebruik één bedrag, bijvoorbeeld 45,50.</p>}</EditorField></div>
        <details className="pe-more"><summary>Meer gegevens <ChevronDown size={16} /></summary><div className="pe-fields"><EditorField id="maker" label="Maker / Merk"><input id="product-maker" value={draft.maker} maxLength={180} placeholder="Alleen als je het weet" onChange={e => change('maker', e.target.value)} /></EditorField><EditorField id="material" label="Materiaalomschrijving"><input id="product-material" value={draft.material} maxLength={180} placeholder="Bijvoorbeeld: geglazuurd aardewerk" onChange={e => change('material', e.target.value)} /></EditorField><EditorField id="category" label="Categorie op de website"><select id="product-category" value={draft.category} onChange={e => change('category', e.target.value as Category)}>{categories.filter(c => c.id !== 'alles').map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></EditorField></div></details>
      </section>
      <div className="pe-footer"><span><LockKeyhole size={14} />{draft.publication === 'published' ? 'Dit product is gepubliceerd.' : 'Je product blijft privé.'}</span><div><button type="button" className="a-secondary" disabled={saveState === 'saving' || hasPending} onClick={() => void finish(true)}>Opslaan en volgend product<ArrowRight size={15} /></button><button type="submit" className="a-button" disabled={saveState === 'saving' || hasPending}>{saveState === 'saving' ? <LoaderCircle size={16} className="a-spin" /> : <Save size={16} />}Opslaan</button></div>
</div>
    </fieldset></form>
    <aside className="pe-preview"><div className="pe-preview-heading"><span>Je productfiche</span><span className={`a-status ${draft.editorReady ? 'ready' : ''}`}>{draft.publication === 'archived' ? 'Archief' : draft.editorReady ? 'Klaar' : draft.publication === 'published' ? 'Gepubliceerd' : 'Concept'}</span></div><div className="pe-preview-photo">{draft.photos[0] ? <img src={`/api/images/${draft.photos[0].id}?size=grid`} alt={draft.photos[0].alt} /> : <div><ImagePlus size={38} strokeWidth={1} /><span>Hier komt je hoofdfoto</span></div>}</div><div className="pe-preview-body"><div className="pe-preview-meta"><span>{materialName(draft.materialGroup)}</span><span>{serverItem?.productNumber || 'Nummer volgt'}</span></div><h3>{draft.title || 'Een nieuw verhaal begint hier.'}</h3><span className="pe-preview-price">{draft.price && !Number.isNaN(inputCents(draft.price)) ? money(inputCents(draft.price) || 0) : 'Prijs nog in te vullen'}</span>{draft.description && <p className="pe-preview-description">{draft.description}</p>}<dl>{[['Stijl / Periode', draft.date], ['Afmetingen', draft.dimensions], ['Staat', draft.condition]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><button type="button" className="a-link" onClick={() => void copyText()}><Copy size={14} />Producttekst kopiëren</button></div>
      <div className="pe-checklist"><div className="pe-checklist-heading"><h3>{missing.length ? 'Nog even aanvullen' : 'Alles staat op zijn plek'}</h3><span>{8 - missing.length}/8</span></div><div className="pe-progress" aria-label={`${8 - missing.length} van 8 onderdelen ingevuld`}><span style={{ width: `${(8 - missing.length) / 8 * 100}%` }} /></div>{showCheck || missing.length < 5 ? <ul>{missing.map(m => <li key={m.field}><button type="button" onClick={() => focusField(m.field)}><span className="pe-check-dot" />{m.label}<ArrowRight size={13} /></button></li>)}{hasPending && <li className="pe-hint">Rond de foto-uploads af.</li>}</ul> : <p>Je hoeft niet alles in één keer te doen. Je concept wordt vanzelf bewaard.</p>}<button type="button" className={`a-secondary pe-ready-button ${draft.editorReady ? 'is-ready' : ''}`} disabled={saveState === 'saving' || draft.editorReady || correcting} onClick={() => void markReady()}>{draft.editorReady ? <CheckCheck size={17} /> : <Check size={17} />}{draft.editorReady ? 'Klaar voor later' : 'Markeer als klaar'}</button><p className="pe-hint">Klaar betekent volledig ingevuld. Je publiceert hiermee nog niets.</p></div>
      {serverItem && <details className="pe-manage"><summary>Product beheren<ChevronDown size={15} /></summary><p>Je nummer en geschiedenis blijven altijd bewaard.</p><button type="button" className="a-link" onClick={() => { change('publication', draft.publication === 'archived' ? 'draft' : 'archived'); latest.current = { ...latest.current, publication: draft.publication === 'archived' ? 'draft' : 'archived' }; void save(true); }}>{draft.publication === 'archived' ? <RotateCcw size={14} /> : <Trash2 size={14} />}{draft.publication === 'archived' ? 'Terugzetten naar concept' : 'Product archiveren'}</button>{availability(store, serverItem.id) === 'available' && <div className="pe-direct-sale"><h4>Rechtstreeks verkocht?</h4><p>Registreer een ontvangen betaling en overdracht. Voeg de klant zo nodig eerst toe bij Verkoop → Klanten.</p><label htmlFor="direct-sale-customer">Klant</label><select id="direct-sale-customer" value={customerId} onChange={e => setCustomerId(e.target.value)}><option value="">Kies een klant</option>{store.customers.map(c => <option key={c.id} value={c.id}>{c.name} · {c.email}</option>)}</select><button className="a-secondary" type="button" disabled={!customerId || directBusy || serverItem.priceCents <= 0 || serverItem.priceUnset} onClick={async () => { setDirectBusy(true); try { await onDirect(serverItem.id, customerId); } finally { setDirectBusy(false); } }}>{directBusy ? 'Registreren…' : 'Verkoop registreren'}</button></div>}{availability(store, serverItem.id) !== 'available' && <p>{availability(store, serverItem.id) === 'sold' ? 'Dit product is verkocht. Het nummer en de geschiedenis blijven bewaard.' : 'Dit product is gereserveerd. De afgesproken prijs blijft behouden.'}</p>}</details>}
    </aside></div>
  </div>;
}

function TextAssistant({ draft, onApply }: { draft: Draft; onApply: (fields: Partial<Record<TextTarget, string>>) => void }) {
  const [source, setSource] = useState('');
  const [proposals, setProposals] = useState<Partial<Record<TextTarget, string>>>({});
  const [remainder, setRemainder] = useState('');
  const [selected, setSelected] = useState('');
  const [enabled, setEnabled] = useState<Partial<Record<TextTarget, boolean>>>({});
  const [previous, setPrevious] = useState<Partial<Record<TextTarget, string>> | null>(null);
  const [message, setMessage] = useState('');
  const [analyzed, setAnalyzed] = useState(false);
  function analyze() { const result = divideText(source); setProposals(result.fields); setRemainder(result.remainder); setEnabled(Object.fromEntries(Object.keys(result.fields).map(k => [k, !draft[k as TextTarget]]))); setAnalyzed(true); setMessage(''); }
  function apply() {
    const fields = Object.fromEntries(textTargets.filter(t => enabled[t.key] && proposals[t.key] !== undefined).map(t => [t.key, proposals[t.key]!]));
    if (Object.entries(fields).some(([key, value]) => value.length > textTargets.find(t => t.key === key)!.max)) { setMessage('Een voorstel is te lang. Kort het eerst in; we knippen je tekst niet af.'); return; }
    if (fields.price !== undefined && Number.isNaN(inputCents(fields.price))) { setMessage('De prijs is niet eenduidig. Vul één bedrag in, bijvoorbeeld 45,50.'); return; }
    if (!Object.keys(fields).length) { setMessage('Vink eerst aan welke voorstellen je wilt overnemen.'); return; }
    setPrevious(Object.fromEntries(Object.keys(fields).map(key => [key, draft[key as TextTarget]])));
    onApply(fields); setMessage('Geselecteerde tekst overgenomen. Het origineel blijft hierboven staan.');
  }
  return <div className="pe-text-assistant" id="pe-text-assistant"><div className="pe-assistant-heading"><ClipboardPaste size={20} /><div><h3>Van losse tekst naar een nette fiche</h3><p>Plak je tekst. We herkennen labels zoals ‘Staat:’ en ‘Afmetingen:’.</p></div></div><label className="sr-only" htmlFor="source-text">Bestaande producttekst</label><textarea id="source-text" rows={6} maxLength={12000} value={source} placeholder={'Titel: Groene vaas\nStijl / Periode: Jaren 70\nAfmetingen: H 24 cm\nStaat: Kleine chip aan de onderrand\nPrijs: € 45'} onChange={e => { setSource(e.target.value); setAnalyzed(false); }} onSelect={e => { const el = e.currentTarget; setSelected(el.value.slice(el.selectionStart, el.selectionEnd)); }} />
    <div className="pe-assistant-actions"><button type="button" className="a-button" disabled={!source.trim()} onClick={analyze}>Tekst verdelen<ArrowDown size={15} /></button><span>Of selecteer een stukje tekst en kies een veld:</span><select aria-label="Geselecteerde tekst naar veld" value="" disabled={!selected.trim()} onChange={e => { if (!e.target.value) return; const key = e.target.value as TextTarget; setProposals(p => ({ ...p, [key]: [p[key], selected].filter(Boolean).join('\n') })); setEnabled(p => ({ ...p, [key]: !draft[key] })); setAnalyzed(true); setMessage('Fragment als voorstel toegevoegd. Controleer en vink het aan.'); }}><option value="">Naar veld…</option>{textTargets.map(t => <option value={t.key} key={t.key}>{t.label}</option>)}</select></div>
    {analyzed && <div className="pe-proposals"><h4>Controleer de verdeling</h4>{!Object.keys(proposals).length && <p>Geen veldlabels herkend. Selecteer hierboven een fragment en kies het juiste veld.</p>}{textTargets.filter(t => proposals[t.key] !== undefined).map(target => <div className="pe-proposal" key={target.key}><label><input type="checkbox" checked={Boolean(enabled[target.key])} onChange={e => setEnabled(p => ({ ...p, [target.key]: e.target.checked }))} /><span>{target.label}{draft[target.key] && <small>Vervangt de bestaande inhoud als je dit aanvinkt.</small>}</span></label><textarea aria-label={`Voorstel ${target.label}`} rows={2} value={proposals[target.key] || ''} onChange={e => setProposals(p => ({ ...p, [target.key]: e.target.value }))} /></div>)}{remainder && <div className="pe-unassigned"><strong>Nog niet verdeeld</strong><p>{remainder}</p></div>}{Object.keys(proposals).length > 0 && <button type="button" className="a-secondary" onClick={apply}><Check size={15} />Geselecteerde velden overnemen</button>}</div>}
    {message && <p role="status" className="pe-assistant-message">{message}</p>}{previous && <button type="button" className="a-link" onClick={() => { onApply(previous); setPrevious(null); setMessage('De vorige veldinhoud is hersteld.'); }}><RotateCcw size={14} />Verdeling ongedaan maken</button>}
  </div>;
}
