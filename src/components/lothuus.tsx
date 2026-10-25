'use client';
import { observeFreshness } from '@/lib/client-refresh';

import Image from 'next/image';
import { DoorwayHero } from './doorway-hero';
import { ArrowUpRight, Heart, Download, Plus, Check } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type CSSProperties } from 'react';
import { objects as suppliedObjects, categories, categoryLabel, type Category, type CollectionObject } from '@/lib/collection';
import { Mosaic } from './mosaic';
import { Dialog } from './dialog';
import { HeartButton } from './heart-button';
import { LegalLinks } from './legal-page';
import { syncHeartSelection, trackHeart } from '@/lib/hearts/client';
import { SelectionDialog, type CheckoutAttempt, type CheckoutDraft, type SelectionObject } from './reservation';
import { detailLayout } from '@/lib/detail-layout';
import { money, type PublicSettings } from '@/lib/backend/types';
import { reconcileSelection, removeOrderedSelection } from '@/lib/selection';

function Wordmark({ footer = false }: { footer?: boolean }) {
  return <span className={`wordmark ${footer ? 'wordmark-footer' : ''}`} aria-label="LOTHUUS"><b>LO</b><span>THUUS</span></span>;
}
function Detail({ object, saved, onSave, onClose, onSelection, count }: { object: CollectionObject; saved: boolean; onSave: () => void; onClose: () => void; onSelection: () => void; count: number }) {
  const [image, setImage] = useState({ src: object.image, width: 1200, height: 1600 });
  const photo = image.src;
  const [viewport, setViewport] = useState({ width: 1200, height: 900 });
  const [photoError, setPhotoError] = useState('');
  const photoRequest = useRef(0);
  useEffect(() => {
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    resize(); window.addEventListener('resize', resize);
    return () => { photoRequest.current++; window.removeEventListener('resize', resize); };
  }, []);
  async function choosePhoto(src: string) {
    const request = ++photoRequest.current;
    setPhotoError('');
    const next = new window.Image(); next.src = src;
    try { await next.decode(); } catch {
      if (request === photoRequest.current) setPhotoError('Deze foto kan niet worden geladen. Probeer opnieuw.');
      return;
    }
    if (request !== photoRequest.current) return;
    setImage({ src, width: next.naturalWidth, height: next.naturalHeight });
  }
  const layout = detailLayout(image.width / image.height, viewport, false);
  const dialogStyle = { width: layout.width, '--detail-photo-width': `${layout.photoWidth}px`, '--detail-photo-height': `${layout.photoHeight}px` } as CSSProperties;
  const live = object.priceCents !== undefined;
  return <Dialog title={object.title} onClose={onClose} className={`detail-dialog detail-${layout.mode}`} style={dialogStyle}>
    <div className="detail-image"><Image src={photo} unoptimized alt={object.photos?.find(p => photo.includes(p.id))?.alt || object.title} width={image.width} height={image.height} sizes="(max-width: 700px) 95vw, 800px" preload onLoad={event => {
      const loaded = event.currentTarget;
      if (loaded.naturalWidth && loaded.naturalHeight) setImage(current => current.src === photo && (current.width !== loaded.naturalWidth || current.height !== loaded.naturalHeight) ? { src: photo, width: loaded.naturalWidth, height: loaded.naturalHeight } : current);
    }} />
      <HeartButton className="detail-heart" selected={saved} aria-label={`${saved ? 'Verwijder' : 'Bewaar'} ${object.title} ${saved ? 'uit' : 'in'} je selectie`} onClick={onSave} />
    </div>
    <div className="detail-content">
      <p className="detail-category">{categoryLabel(object.category)} <span>{object.date}</span></p>
      <h2>{object.title}</h2>
      {live && <p className="detail-price">{money(object.priceCents!)} <span>{({ available: 'Beschikbaar', reserved: 'Gereserveerd', sold: 'Verkocht' })[object.availability || 'available']}</span></p>}
      <p className="detail-intro">{object.description || "Bekijk dit object uit de LOTHUUS-collectie vanuit verschillende hoeken. Meer productinformatie volgt binnenkort."}</p>
      {object.condition && <p className="detail-intro">{object.condition}</p>}
      {object.photos && object.photos.length > 1 && <div className="detail-photo-strip">{object.photos.map(p => <button key={p.id} aria-label={`Bekijk ${p.alt}`} aria-pressed={photo.includes(p.id)} onClick={() => { void choosePhoto(p.src || `/api/images/${p.id}?size=detail`); }}><img src={p.src || `/api/images/${p.id}?size=thumb`} alt={p.alt} /></button>)}</div>}
      {photoError && <p className="detail-note" role="status">{photoError}</p>}
      <dl className="object-facts">{object.date && <div><dt>Periode</dt><dd>{object.date}</dd></div>}<div><dt>Materiaal</dt><dd>{object.material}</dd></div>{object.dimensions && <div><dt>Afmetingen</dt><dd>{object.dimensions}</dd></div>}</dl>
      {!live && object.description && <details className="original-description"><summary>Het verhaal achter dit object <Plus size={14} /></summary><p lang="en">{object.description}</p></details>}
      <p className="availability">{live ? ({ available: "Beschikbaar", reserved: "Gereserveerd", sold: "Verkocht" })[object.availability || "available"] : "Uit de LOTHUUS-collectie"}</p>
      <button type="button" className={`primary-button detail-add-button ${saved ? 'is-saved' : ''}`} aria-pressed={saved} onClick={onSave}>
        {saved ? 'Toegevoegd aan mijn selectie' : 'Voeg toe aan mijn selectie'}
        {saved ? <Check size={19} aria-hidden="true" /> : <Heart size={19} aria-hidden="true" />}
      </button>
      <p className="detail-save-status" role="status">{saved ? 'Bewaard. Klik nogmaals om dit object te verwijderen.' : 'Bewaar je favoriete vondsten en bekijk ze samen in je selectie.'}</p>
      {count > 0 && <button className="text-link detail-selection-link" onClick={onSelection}>Bekijk mijn selectie ({count})<ArrowUpRight size={17} /></button>}
      <p className="detail-note">{object.availability === 'reserved' ? 'Dit object is tijdelijk voor een andere klant gereserveerd. Het blijft hier zichtbaar, maar is nu niet bestelbaar.' : object.availability === 'sold' ? 'Dit object heeft een nieuw thuis gevonden.' : live ? 'Verzamel je vondsten in je selectie en bestel ze samen. Je betaalt buiten de website.' : 'Bewaar dit object en laat je selectie reserveren. Katrien bevestigt daarna de prijs en betaalafspraak.'}</p>
      {!live && object.source && <a href={object.source} target="_blank" rel="noreferrer" className="text-link">Herkomst & objectinformatie <ArrowUpRight size={15} /></a>}
      {!live && <span className="image-credit">Fotografie: LOTHUUS</span>}
    </div>
  </Dialog>;
}

export function Lothuus() {
  const [objects, setObjects] = useState<CollectionObject[]>(suppliedObjects);
  const [saved, setSaved] = useState<string[]>([]);
  const [publicSettings, setPublicSettings] = useState<PublicSettings | null>(null);
  const [isSuppliedCollection, setIsSuppliedCollection] = useState(true);
  const catalogueRequest = useRef(0), cataloguePending = useRef(false), catalogueLoaded = useRef(0);
  const catalogueTag = useRef<string | undefined>(undefined);
  const catalogueObjects = useRef(suppliedObjects);
  const refreshCatalogue = useCallback(async () => {
    if (cataloguePending.current) return; cataloguePending.current = true;
    const request = ++catalogueRequest.current;
    try { const response = await fetch('/api/catalogue', { cache: 'no-store', headers: catalogueTag.current ? { 'If-None-Match': catalogueTag.current } : {}, signal: AbortSignal.timeout(15000) }); if (response.status === 304) { catalogueLoaded.current = Date.now(); return; } if (!response.ok) throw new Error(); const data = await response.json(); if (request !== catalogueRequest.current) return; catalogueLoaded.current = Date.now(); catalogueTag.current = response.headers.get('etag') || undefined; catalogueObjects.current = data.objects; setObjects(current => { const next = data.objects; return JSON.stringify(current) === JSON.stringify(next) ? current : next; }); setSaved(current => { const next = reconcileSelection(current, data.objects); return next.every((id, index) => id === current[index]) && next.length === current.length ? current : next; }); setIsSuppliedCollection(!data.hasInventory); setPublicSettings(data.settings); }
    catch { if (request === catalogueRequest.current) { catalogueTag.current = undefined; setPublicSettings(null); } }
    finally { cataloguePending.current = false; }
  }, []);
  useEffect(() => { void refreshCatalogue(); return observeFreshness(refreshCatalogue, () => catalogueLoaded.current); }, [refreshCatalogue]);
  const [filter, setFilter] = useState<Category | 'alles'>('alles');
  const filterAnchor = useRef<HTMLDivElement>(null);
  function chooseFilter(next: Category | 'alles') {
    if (next === filter) return;
    const toolbar = filterAnchor.current;
    if (toolbar) {
      const top = toolbar.getBoundingClientRect().top;
      if (top < -1 || top > window.innerHeight * .45) {
        window.scrollTo({ top: window.scrollY + top, behavior: 'instant' });
      }
    }
    setFilter(next);
  }
  const [detail, setDetail] = useState<CollectionObject | null>(null);
  const [panel, setPanel] = useState<'how' | 'selection' | 'contact' | null>(null);
  const snapshots = useRef<Record<string, { title: string; image: string }>>({});
  const [feedback, setFeedback] = useState('');
  const [checkoutDraft, setCheckoutDraft] = useState<CheckoutDraft>({ name: '', email: '', phone: '', message: '' });
  const checkoutAttempt = useRef<CheckoutAttempt | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const downloadUrl = useRef<string | null>(null);
  useEffect(() => {
    try { const info = JSON.parse(localStorage.getItem('lothuus-selection-info') || '{}'); snapshots.current = info && typeof info === 'object' && !Array.isArray(info) ? info : {}; const ids: unknown = JSON.parse(localStorage.getItem('lothuus-selection') || '[]'); if (Array.isArray(ids)) setSaved([...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length < 128))].slice(0, 500)); } catch { /* Private browsing still supports an in-memory selection. */ }
    setStorageReady(true);
    return () => { if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current); };
  }, []);
  useEffect(() => { const sync = (event: StorageEvent) => { if (event.key !== 'lothuus-selection') return; try { const info = JSON.parse(localStorage.getItem('lothuus-selection-info') || '{}'); if (info && typeof info === 'object' && !Array.isArray(info)) snapshots.current = info; const ids: unknown = JSON.parse(event.newValue || '[]'); if (Array.isArray(ids)) setSaved(reconcileSelection([...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length < 128))].slice(0, 500), objects)); } catch {} }; window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync); }, [objects]);
  useEffect(() => { if (storageReady) { try { for (const object of objects) if (saved.includes(object.id)) snapshots.current[object.id] = { title: object.title, image: object.image }; localStorage.setItem('lothuus-selection-info', JSON.stringify(Object.fromEntries(saved.map(id => [id, snapshots.current[id]])))); localStorage.setItem('lothuus-selection', JSON.stringify(saved)); } catch { /* Selection remains usable without storage. */ } } }, [saved, storageReady, objects]);
  const selected: SelectionObject[] = saved.map(id => {
    const current = objects.find(object => object.id === id);
    if (current) return current;
    const source = suppliedObjects.find(object => object.id === id);
    return { id, title: snapshots.current[id]?.title || source?.title || 'Object niet meer beschikbaar', image: snapshots.current[id]?.image || source?.image || '', category: source?.category || 'objecten', date: '', material: '', dimensions: '', maker: '', source: '', credit: '', imageSource: '', license: '', description: 'Dit object is niet meer beschikbaar in de actuele collectie.', missing: true };
  });
  const currentDetail = detail ? objects.find(o => o.id === detail.id || o.sourceReference === detail.id) || detail : null;
  const filtered = useMemo(() => filter === 'alles' ? objects : objects.filter(object => object.category === filter), [objects, filter]);
  const countedCategories = categories.map(category => ({
    ...category,
    count: category.id === 'alles' ? objects.length : objects.filter(object => object.category === category.id).length,
  })).filter(category => category.id === 'alles' || category.count > 0);
  useEffect(() => {
    if (!storageReady) return;
    const refresh = () => { if (!document.hidden) { void syncHeartSelection(saved); } };
    refresh();
    window.addEventListener('online', refresh); window.addEventListener('focus', refresh);
    return () => { window.removeEventListener('online', refresh); window.removeEventListener('focus', refresh); };
  }, [saved, storageReady]);
  function toggleSaved(id: string) { void trackHeart(id, !saved.includes(id), saved); setFeedback(saved.includes(id) ? 'Verwijderd uit je selectie' : 'Toegevoegd aan je selectie'); setSaved(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]); setDownloaded(false); }
  useEffect(() => { if (!feedback) return; const timer = setTimeout(() => setFeedback(''), 4500); return () => clearTimeout(timer); }, [feedback]);
  function openSelection() { setDetail(null); setPanel('selection'); setFeedback(''); }
  function prepareEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = `LOTHUUS — Informatieaanvraag\n\nNaam: ${data.get('name')}\nE-mail: ${data.get('email')}\n\n${data.get('message') || ''}\n\nMijn selectie:\n${selected.map(object => `— ${object.title} (${object.date})\n  ${object.source}`).join('\n')}\n\nDit document is lokaal voorbereid. Er is nog niets verstuurd.\n`;
    if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current);
    downloadUrl.current = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = downloadUrl.current; link.download = 'lothuus-informatieaanvraag.txt'; link.click(); setDownloaded(true);
  }
  return <>
    <a href="#collectie" className="skip-link">Naar de collectie</a>
    <main>
      <DoorwayHero>
      <section id="collectie" tabIndex={-1} className="collection-section" aria-label="LOTHUUS vintagecollectie">
        <div ref={filterAnchor} aria-hidden="true" />
        <header className="collection-toolbar collection-navbar">
          <a href="#collectie" className="brand-link" aria-label="LOTHUUS, naar het begin van de collectie"><Wordmark /></a>
          <div className="category-filters" role="group" aria-label="Filter de collectie">{countedCategories.map(category => <button key={category.id} aria-pressed={filter === category.id} aria-label={`${category.label}, ${category.count} ${category.count === 1 ? 'object' : 'objecten'}`} onClick={() => chooseFilter(category.id)}><span>{category.label}</span><sup className="category-count" aria-hidden="true">{category.count}</sup></button>)}</div>
          <button className="selection-button" onClick={openSelection} aria-label={`Mijn selectie, ${saved.length} ${saved.length === 1 ? 'object' : 'objecten'}`}><Heart size={18} strokeWidth={1.4} /><span className="selection-label">Mijn selectie</span><span className="selection-count">{String(saved.length).padStart(2, '0')}</span></button>
        </header>
        {filtered.length ? <Mosaic objects={filtered} filterKey={filter} focused={filter !== 'alles'} saved={saved} onToggle={toggleSaved} onOpen={setDetail} /> : <p className="catalogue-empty">Binnenkort vind je hier nieuwe objecten. Kom gerust nog eens kijken.</p>}
        <div className="collection-bottom"><span>{String(filtered.length).padStart(3, '0')} objecten met een verleden</span><p>Het mooiste vind je als je even blijft kijken.</p><button className="text-link" onClick={() => setPanel('how')}>Over dit archief <Plus size={14} /></button></div>
      </section>
      </DoorwayHero>
      <section className="house-section" id="huis" aria-labelledby="house-heading">
        <div className="house-photographs">
          <figure className="house-photo"><Image src="/house/lothuus-today-restored.png" alt="LOTHUUS vandaag: de okerkleurige gevel met donkere ramen, balkon en de boom voor het huis" width={1604} height={981} sizes="(max-width: 540px) 100vw, 45vw" loading="eager" /><figcaption><span>Het huis, vandaag</span><span>LOTHUUS</span></figcaption></figure>
          <div className="house-history"><figure className="house-photo historic-photo"><Image src="/house/lothuus-historic-restored.png" alt="Historische sepiafoto van hetzelfde LOTHUUS-huis, gezien vanaf de straathoek" width={1535} height={1024} sizes="(max-width: 540px) 55vw, 24vw" /><figcaption>Het huis, vroeger</figcaption></figure><p>Hetzelfde huis.<br /><em>Een ander hoofdstuk.</em></p></div>
        </div>
        <div className="house-copy"><span className="house-small-wordmark"><Wordmark /></span><h2 id="house-heading">Een huis voor cultuur<br />en <em>ontmoeting</em></h2><p>Sommige plekken brengen iets samen. Mensen en ideeën. Kunst en muziek. Het vertrouwde en het onverwachte.</p><p>LOTHUUS is zo’n plek. Ook onze liefde voor vintage begint hier: bij dingen die blijven boeien, en de verhalen die we met elkaar delen.</p><div className="house-topics"><span>CONCERTS</span><span>ART</span><span>MEETINGS</span><span>EVENTS</span></div><button className="text-link" onClick={() => setPanel('contact')}>Laten we kennismaken <ArrowUpRight size={17} /></button></div>
      </section>
      <a className="house-explorer-route text-link" href="/huis">Verken het huis vrij in 3D <ArrowUpRight size={17}/></a>
    </main>
    <footer className="site-footer"><div className="footer-top"><a href="#" aria-label="LOTHUUS, naar boven"><Wordmark footer /></a><p>Een huis voor cultuur<br />en ontmoeting.</p><button onClick={() => setPanel('contact')}>Kom in contact <ArrowUpRight size={16} /></button></div><div className="footer-bottom"><span>© {new Date().getFullYear()} LOTHUUS</span><span>Met aandacht verzameld. Met liefde doorgegeven.</span><span>LOTHUUS collectie · <a href="/admin">Beheer</a></span></div><LegalLinks /></footer>
    <div className={`selection-feedback ${feedback ? 'is-visible' : ''}`} role="status" aria-live="polite">{feedback && <><Heart size={16} fill="currentColor" /><span>{feedback}</span><button onClick={openSelection}>Bekijk selectie<ArrowUpRight size={15} /></button></>}</div>
    {currentDetail && <Detail key={`${currentDetail.id}:${currentDetail.image}`} object={currentDetail} saved={saved.includes(currentDetail.id)} onSave={() => toggleSaved(currentDetail.id)} onClose={() => setDetail(null)} onSelection={openSelection} count={saved.length} />}
    {panel === 'selection' && <SelectionDialog objects={selected} settings={publicSettings} draft={checkoutDraft} onDraft={setCheckoutDraft} attempt={checkoutAttempt} onClose={() => setPanel(null)} onRemove={toggleSaved} onOpen={object => { setPanel(null); setDetail(object); }} onRefresh={() => { void refreshCatalogue(); }} onOrdered={ids => { setCheckoutDraft({ name: '', email: '', phone: '', message: '' }); setSaved(current => removeOrderedSelection(current, ids, catalogueObjects.current)); void refreshCatalogue(); }} />}
    {panel === 'how' && <Dialog title="Een levend archief" onClose={() => setPanel(null)} className="info-dialog"><h2>Volg je<br /><em>nieuwsgierigheid.</em></h2><div className="how-step"><ArrowUpRight size={23} strokeWidth={1.2} /><div><h3>Geef een object de ruimte</h3><p>Beweeg over een foto. Het object groeit en de andere foto’s schuiven vloeiend eromheen. Op je telefoon tik je direct voor alle details.</p></div></div><div className="how-step"><Plus size={23} strokeWidth={1.2} /><div><h3>Ontdek wat erachter zit</h3><p>Klik of tik op een object. Bekijk alle foto’s en details en bewaar je favorieten. Met Tab en de pijltjestoetsen kun je de collectie ook verkennen.</p></div></div><div className="how-step"><Heart size={22} strokeWidth={1.2} /><div><h3>Neem je selectie mee</h3><p>Tik op het hartje bij je vondsten. Je selectie blijft bewaard in deze browser. Bestel beschikbare objecten samen en betaal buiten de website.</p></div></div><p className="archive-disclosure">{isSuppliedCollection ? `Dit zijn ${objects.length} objecten uit de eigen LOTHUUS-collectie, gefotografeerd door LOTHUUS. Productinformatie en prijzen worden nog aangevuld. Je vindt alle aangeleverde foto’s in het detailvenster van elk object.` : "Je kunt beschikbare objecten samen bestellen vanuit je selectie. Betalen gebeurt handmatig via overschrijving."} De huisfoto’s komen uit het aangeleverde LOTHUUS-archief en zijn digitaal opgefrist.</p><button className="primary-button" onClick={() => setPanel(null)}>Ik ga op ontdekking <ArrowUpRight size={18} /></button></Dialog>}
    {panel === 'contact' && <Dialog title="Contact voorbereiden" onClose={() => setPanel(null)} className="selection-dialog"><h2>Een verhaal begint<br /><em>met een gesprek.</em></h2>
      <form className="enquiry-form" onSubmit={prepareEnquiry}><p>Bereid je bericht voor. Je downloadt een tekstbestand met je gegevens en selectie; er wordt niets automatisch verstuurd.</p><label>Naam<input name="name" autoComplete="name" required placeholder="Je naam" maxLength={120} /></label><label>E-mailadres<input name="email" type="email" autoComplete="email" required placeholder="jij@voorbeeld.be" maxLength={180} /></label><label>Je bericht <span>(optioneel)</span><textarea name="message" rows={3} maxLength={3000} placeholder="Wat zou je graag willen weten?" /></label><button className="primary-button" type="submit">Download je informatieaanvraag <Download size={17} /></button><p className="download-status" role="status">{downloaded ? 'Je aanvraag is gedownload. Er is nog niets verstuurd.' : 'Je gegevens blijven op je eigen apparaat.'}</p></form>
    </Dialog>}
  </>;
}
