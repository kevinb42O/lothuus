'use client';
import { observeFreshness } from '@/lib/client-refresh';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Heart, RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { dateTime, type Item } from '@/lib/backend/types';
import { categories } from '@/lib/collection';
import type { HeartReport } from '@/lib/hearts/types';
import { hasExtendedAnalytics } from '@/lib/hosting/access';
import './hearts.css';
const statusLabel: Record<string,string> = { available: 'Beschikbaar', reserved: 'Gereserveerd', sold: 'Verkocht', archived: 'Gearchiveerd', missing: 'Niet meer gepubliceerd' };
const dayLabel = (day: string) => new Intl.DateTimeFormat('nl-BE', {day:'numeric',month:'short'}).format(new Date(`${day}T12:00:00Z`));
function Trend({ report }: { report: HeartReport }) {
  const weekly = report.series.length > 90;
  const groups: HeartReport['series'] = [];
  report.series.forEach((d,i)=>{ if (!weekly || i%7 === 0) groups.push({...d}); else { const g=groups.at(-1)!; g.added+=d.added; g.removed+=d.removed; g.ordered+=d.ordered; } });
  const peak = Math.max(0,...groups.flatMap(d=>[d.added,d.removed]));
  return <section className="hi-trend" aria-labelledby="hi-trend-title"><div className="hi-section-heading"><div><h2 id="hi-trend-title">Hoe de interesse evolueert</h2><p>{weekly ? 'Per week' : 'Per dag'} · {dayLabel(report.from)} – {dayLabel(report.to)}</p></div><div className="hi-legend"><span><i />Toegevoegd</span><span><i />Verwijderd</span></div></div>
    <div className="hi-chart" role="img" aria-label={`Evolutie van ${report.totals.added} toegevoegde en ${report.totals.removed} verwijderde hartjes. Alle cijfers staan ook in de uitklapbare tabel.`}>
      <span className="hi-peak">{peak}</span><div className="hi-bars">{groups.map(d=><div className="hi-bar-pair" key={d.day} title={`${dayLabel(d.day)}: ${d.added} toegevoegd, ${d.removed} verwijderd`}><span style={{height:`${d.added/Math.max(1,peak)*100}%`}} /><span style={{height:`${d.removed/Math.max(1,peak)*100}%`}} /></div>)}</div>
    </div><div className="hi-chart-axis"><span>{dayLabel(report.from)}</span><span>{dayLabel(report.to)}</span></div>
    <details className="hi-data"><summary>Bekijk de cijfers als tabel</summary><div className="a-table-wrap"><table><caption className="sr-only">Hartjes per {weekly?'week':'dag'}</caption><thead><tr><th scope="col">{weekly?'Week vanaf':'Datum'}</th><th scope="col">Toegevoegd</th><th scope="col">Verwijderd</th><th scope="col">Na reservering opgeruimd</th></tr></thead><tbody>{groups.map(d=><tr key={d.day}><th scope="row">{dayLabel(d.day)}</th><td>{d.added}</td><td>{d.removed}</td><td>{d.ordered}</td></tr>)}</tbody></table></div></details>
  </section>;
}
export function Hearts({ items, onEdit }: { items: Item[]; onEdit: (item: Item) => void }) {
  const [period,setPeriod]=useState('7'),[query,setQuery]=useState(''),[category,setCategory]=useState(''),[status,setStatus]=useState(''),[sort,setSort]=useState('added'),[page,setPage]=useState(1),[object,setObject]=useState('');
  const [report,setReport]=useState<HeartReport|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[changing,setChanging]=useState(false),[debounced,setDebounced]=useState('');
  const request = useRef(0); const heading = useRef<HTMLHeadingElement>(null);
  useEffect(()=>{ const timer=setTimeout(()=>{ setDebounced(query); setPage(1); },250); return ()=>clearTimeout(timer); },[query]);
  const loadedAt = useRef(0);
  const reload=useCallback(async(signal?:AbortSignal)=>{
    const version=++request.current; setLoading(true);
    try { const params=new URLSearchParams({period,q:debounced,category,status,sort,page:String(page),object}); const response=await fetch(`/api/admin/hearts?${params}`,{cache:'no-store',signal: signal || AbortSignal.timeout(15000)}); const body=await response.json(); if(response.status===403 && period!=='7' && version===request.current){setReport(null);setPeriod('7');setPage(1);return;} if(!response.ok) throw new Error(body.error); if(version===request.current){loadedAt.current=Date.now();setReport(body);setError('');} }
    catch(e){if(version===request.current && (e as Error).name!=='AbortError')setError((e as Error).message || 'De hartjes konden niet worden opgehaald. Probeer opnieuw.');}
    finally{if(version===request.current)setLoading(false);}
  },[period,debounced,category,status,sort,page,object]);
  useEffect(()=>{ const controller=new AbortController();void reload(controller.signal); const stop=observeFreshness(()=>reload(),()=>loadedAt.current);return()=>{controller.abort();++request.current;stop();};},[reload]);
  useEffect(()=>{if(object && report?.detail)heading.current?.focus();},[object,report?.detail?.id]);
  async function toggle(){ if(!report)return;setChanging(true);try{const res=await fetch('/api/admin/hearts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:!report.enabled})});const body=await res.json();if(!res.ok)throw new Error(body.error);await reload();}catch(e){setError((e as Error).message);}finally{setChanging(false);} }
  const reset=()=>{setQuery('');setDebounced('');setCategory('');setStatus('');setPage(1);};
  const detail=report?.detail;
  const completeAdded=report?.series.slice(0,-1).reduce((n,d)=>n+d.added,0)||0;
  return <div className="hi-workspace" aria-busy={loading}>
    <div className="hi-controls"><label>Periode<select value={period} onChange={e=>{setPeriod(e.target.value);setPage(1);}}><option value="7">Laatste 7 dagen</option><option value="30" disabled={!hasExtendedAnalytics(report?.plan)}>Laatste 30 dagen · Pro</option><option value="90" disabled={!hasExtendedAnalytics(report?.plan)}>Laatste 90 dagen · Pro</option><option value="all" disabled={!hasExtendedAnalytics(report?.plan)}>Sinds de meetstart · Pro</option></select></label><button className="a-secondary" onClick={()=>void reload()} disabled={loading}><RefreshCw size={15} className={loading?'a-spin':''} />Vernieuwen</button><span className="hi-updated" role="status">{loading?'Gegevens bijwerken…':report?`Bijgewerkt ${dateTime(report.updatedAt)}`:'Gegevens ophalen…'}</span></div>
    {!hasExtendedAnalytics(report?.plan) && <p className="a-subtle">Op Free zijn periodes tot en met 7 dagen beschikbaar. Uitgebreide analytics zijn beschikbaar vanaf Pro.</p>}
    {error && <div className="a-error" role="alert">{error} {report && 'De laatst geladen cijfers blijven zichtbaar.'}<button className="a-link" onClick={()=>void reload()}>Opnieuw proberen</button></div>}
    {!report && !error && <p role="status">De interesse in je collectie wordt opgehaald…</p>}
    {report && <>
      {!report.enabled && <div className="a-info">De meting staat uit. Bestaande cijfers blijven beschikbaar; nieuwe hartjes worden niet geregistreerd.</div>}
      {object && <button className="a-back" onClick={()=>setObject('')}><ArrowLeft size={15} />Alle objecten bekijken</button>}
      {detail && <section className="hi-object-detail">{detail.image && <img src={detail.image} alt="" width={110} height={130} />}<div><h2 tabIndex={-1} ref={heading}>{detail.title}</h2><p>{detail.reference} · {statusLabel[detail.availability]}</p><p>{detail.recent} recent bewaard · {detail.reservations} webreserveringen in deze periode{detail.cancelled>0?` (${detail.cancelled} geannuleerd of vervallen)`:''}</p>{detail.itemId && <button className="a-link" onClick={()=>{const item=items.find(i=>i.id===detail.itemId);if(item)onEdit(item);}}>Productfiche openen<ArrowUpRight size={14} /></button>}</div></section>}
      <dl className="hi-totals"><div><dt>Toegevoegde hartjes</dt><dd>{report.totals.added}</dd></div><div><dt>Handmatig verwijderd</dt><dd>{report.totals.removed}</dd></div><div><dt>Objecten met nieuwe interesse</dt><dd>{report.totals.objects}</dd></div></dl>
      {hasExtendedAnalytics(report.plan) && <p className="hi-comparison">{report.comparable ? `${completeAdded} toevoegingen in de ${report.series.length-1} volledige dagen vóór vandaag, tegenover ${report.previousAdded} in de even lange periode ervoor.` : 'Nog onvoldoende meetgegevens voor een vergelijking van volledige periodes.'}</p>}
      {report.totals.added===0 && report.totals.removed===0 && <div className="hi-empty"><Heart size={24} strokeWidth={1.4} /><div><h2>{object?'Nog geen nieuwe hartjes in deze periode.':'Hier krijgt belangstelling een gezicht.'}</h2><p>{query||category||status?'Geen hartjes binnen deze periode en filters. Probeer een ruimere selectie.':'Zodra bezoekers objecten bewaren, zie je hier welke stukken aandacht krijgen. Bestaande selecties tellen als beginstand, niet als nieuwe hartjes.'}</p></div></div>}
      <Trend report={report} />
      {!object && <section aria-labelledby="hi-list-title"><div className="hi-section-heading"><div><h2 id="hi-list-title">Welke objecten worden bewaard?</h2><p>Gerangschikt op gemeten belangstelling.</p></div></div>
        <div className="hi-filters"><label className="hi-search"><span className="sr-only">Zoek op productnummer of titel</span><Search size={17} /><input type="search" placeholder="Zoek op nummer of titel…" value={query} onChange={e=>setQuery(e.target.value)} /></label><label>Categorie<select value={category} onChange={e=>{setCategory(e.target.value);setPage(1);}}><option value="">Alle categorieën</option>{report.categories.map(c=><option key={c} value={c}>{categories.find(v=>v.id===c)?.label||c}</option>)}</select></label><label>Voorraad<select value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="">Alle statussen</option>{Object.entries(statusLabel).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Sorteren<select value={sort} onChange={e=>{setSort(e.target.value);setPage(1);}}><option value="added">Meeste nieuwe hartjes</option><option value="recent">Meest recent bewaard</option><option value="latest">Laatste interesse</option></select></label></div>
        {(query||category||status) && <button className="a-link hi-reset" onClick={reset}>Filters herstellen</button>}
        <p className="hi-count">{report.totalRows} {report.totalRows===1?'object':'objecten'} · Klik op een object voor het verloop en de reserveringen.</p>
        {report.rows.length ? <div className="a-table-wrap hi-table"><table><thead><tr><th scope="col">Object</th><th scope="col">Voorraad</th><th scope="col">Toegevoegd</th><th scope="col">Verwijderd</th><th scope="col"><abbr title="Laatst bekende selecties van browsers die de voorbije 90 dagen synchroniseerden. Dit venster is onafhankelijk van de periodefilter.">Recent bewaard</abbr></th><th scope="col">Laatste interesse</th></tr></thead><tbody>{report.rows.map(row=><tr key={row.id}><td><button className="hi-object" onClick={()=>setObject(row.id)}>{row.image && <img src={row.image} alt="" width={48} height={56} />}<span><strong>{row.title}</strong><small>{row.reference}</small></span><ArrowUpRight size={14} /></button></td><td><span className="a-status">{statusLabel[row.availability]}</span></td><td>{row.added}</td><td>{row.removed}</td><td>{row.recent}</td><td>{row.lastSeen?dayLabel(row.lastSeen):'Alleen beginstand'}</td></tr>)}</tbody></table></div>:<div className="a-empty"><h3>Geen objecten in deze weergave.</h3><p>{query||category||status?'Herstel de filters om opnieuw alle gemeten objecten te zien.':'Na de eerste synchronisatie verschijnen hier de objecten die bezoekers bewaren.'}</p></div>}
        {report.pages>1 && <nav className="hi-pagination" aria-label="Pagina’s met objecten"><button className="a-secondary" disabled={report.page===1||loading} onClick={()=>setPage(report.page-1)}><ChevronLeft size={16} />Vorige</button><span>Pagina {report.page} van {report.pages}</span><button className="a-secondary" disabled={report.page===report.pages||loading} onClick={()=>setPage(report.page+1)}>Volgende<ChevronRight size={16} /></button></nav>}
      </section>}
      <aside className="hi-explanation"><h2>Wat vertellen deze cijfers?</h2><p>Een hartje is gemeten interesse per browser, geen unieke persoon of koopbelofte. Herhaald laden telt niet opnieuw. Opnieuw toevoegen na verwijderen telt wel als een nieuwe toevoeging. Opruimen na een reservering telt apart en is geen handmatige verwijdering.</p><p>Recent bewaard toont de laatst bekende selecties van browsers die binnen 90 dagen synchroniseerden. Gewiste browsergegevens, andere apparaten en geblokkeerde meetaanvragen kunnen we niet herkennen. Reserveringen zijn aanvullende objectgegevens; we koppelen geen bezoekers aan klanten.</p><p>Meetstart: {dateTime(report.startedAt)}. Dagtotalen worden maximaal 24 maanden bewaard. De grafiek volgt Belgische kalenderdagen; vandaag is nog niet volledig.</p><button className="a-secondary" disabled={changing} onClick={()=>void toggle()}>{changing?'Instelling bewaren…':report.enabled?'Meting pauzeren':'Meting inschakelen'}</button></aside>
    </>}
  </div>;
}
