'use client';
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Activity, BarChart3, LockKeyhole, ChevronDown, ChevronLeft, ChevronRight, Clock3, Monitor, RefreshCw } from 'lucide-react';
import { deviceNames, periods, type AnalyticsReport, type Period, type Point } from '@/lib/analytics/types';
import { hasExtendedAnalytics } from '@/lib/hosting/access';
import type { HostingPlan } from '@/lib/hosting/catalogue';
import './visitors.css';

const number = new Intl.NumberFormat('nl-BE');
const day = new Intl.DateTimeFormat('nl-BE', { timeZone: 'Europe/Brussels', day: 'numeric', month: 'short' });
const fullDay = new Intl.DateTimeFormat('nl-BE', { timeZone: 'Europe/Brussels', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const hour = new Intl.DateTimeFormat('nl-BE', { timeZone: 'Europe/Brussels', hour: '2-digit', minute: '2-digit' });
const month = new Intl.DateTimeFormat('nl-BE', { timeZone: 'Europe/Brussels', month: 'short', year: 'numeric' });
const date = (at: string) => new Date(at.length === 10 ? at + 'T12:00:00Z' : at);
function rangeLabel(report: AnalyticsReport) {
  return `${day.format(date(report.from))}${report.period === '24h' ? `, ${hour.format(date(report.from))}` : ''} – ${day.format(date(report.to))}${report.period === '24h' ? `, ${hour.format(date(report.to))}` : ''}`;
}
function pointLabel(point: Point, granularity: AnalyticsReport['granularity'], full = false) {
  if (granularity === 'hour') return full ? new Intl.DateTimeFormat('nl-BE', { timeZone: 'Europe/Brussels', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'shortOffset' }).format(date(point.at)) : hour.format(date(point.at));
  return granularity === 'month' ? month.format(date(point.at)) : (full ? fullDay : day).format(date(point.at));
}

function Skeleton() {
  return <div className="av-skeleton" aria-hidden="true"><section className="av-panel av-chart-panel"><div className="av-panel-heading"><div><span className="av-placeholder av-placeholder-title" /><span className="av-placeholder av-placeholder-subtitle" /></div></div><div className="av-skeleton-plot">{[0, 1, 2, 3, 4].map(n => <div key={n}><span className="av-placeholder" /><i /></div>)}<div className="av-skeleton-axis">{[0, 1, 2, 3, 4].map(n => <span className="av-placeholder" key={n} />)}</div></div><span className="av-placeholder av-placeholder-link" /></section><section className="av-panel av-device-panel"><span className="av-placeholder av-placeholder-title" /><span className="av-placeholder av-placeholder-subtitle" />{[0, 1].map(n => <div className="av-skeleton-device" key={n}><span className="av-placeholder" /><span className="av-placeholder" /><i className="av-placeholder" /><span className="av-placeholder" /></div>)}</section></div>;
}

function Chart({ report, revision }: { report: AnalyticsReport; revision: number }) {
  const id = useId().replaceAll(':', ''), reduced = useReducedMotion();
  const [active, setActive] = useState<number | null>(null), [focused, setFocused] = useState(false);
  const chart = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1000, height: 310 });
  useEffect(() => {
    const element = chart.current; if (!element) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element); return () => observer.disconnect();
  }, []);
  const points = report.points;
  const { width, height } = size;
  const left = 30, right = 10, top = 18, bottom = 36;
  const peak = Math.max(1, ...points.map(p => p.visits));
  const step = Math.max(1, Math.ceil(peak / 4)); const ceiling = step * Math.min(4, Math.max(1, Math.ceil(peak / step)));
  const ticks = Array.from({ length: Math.ceil(ceiling / step) + 1 }, (_, n) => n * step);
  const x = (i: number) => points.length <= 1 ? (left + width - right) / 2 : left + i / (points.length - 1) * (width - left - right);
  const y = (value: number) => top + (1 - value / ceiling) * (height - top - bottom);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.visits)}`).join(' ');
  const fill = points.length > 1 ? `${path} L${x(points.length - 1)},${height - bottom} L${x(0)},${height - bottom} Z` : '';
  const labels = Math.min(width < 500 ? 3 : 7, points.length);
  const indexes = [...new Set(Array.from({ length: labels }, (_, i) => Math.round(i * (points.length - 1) / Math.max(1, labels - 1))))];
  const chosen = active === null ? null : points[Math.min(active, points.length - 1)];
  const activeIndex = active === null ? 0 : Math.min(active, points.length - 1);
  function keyboard(e: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(e.key)) return;
    e.preventDefault();
    if (e.key === 'Escape') { setActive(null); return; }
    setActive(e.key === 'Home' ? 0 : e.key === 'End' ? points.length - 1 : Math.min(points.length - 1, Math.max(0, (active ?? 0) + (e.key === 'ArrowRight' ? 1 : -1))));
  }
  return <div className="av-chart-wrap">
    <div ref={chart} className="av-chart" tabIndex={0} role="group" aria-roledescription="interactieve grafiek" aria-label={`Bezoeken ${rangeLabel(report)}. Gebruik de pijltjestoetsen om cijfers te bekijken.`} aria-describedby={`${id}-selection`} onKeyDown={keyboard} onFocus={() => { setFocused(true); setActive(0); }} onBlur={() => { setFocused(false); setActive(null); }} onPointerLeave={() => { if (!focused) setActive(null); }} onPointerMove={e => {
      if (e.pointerType === 'touch') return; const bounds = e.currentTarget.getBoundingClientRect();
      setActive(Math.min(points.length - 1, Math.max(0, Math.round(((e.clientX - bounds.left) / bounds.width * width - left) / (width - left - right) * (points.length - 1)))));
    }} onPointerDown={e => { if (e.pointerType === 'touch') { const bounds = e.currentTarget.getBoundingClientRect(); setActive(Math.min(points.length - 1, Math.max(0, Math.round(((e.clientX - bounds.left) / bounds.width * width - left) / (width - left - right) * (points.length - 1))))); } }}>
      <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true" preserveAspectRatio="none">
        <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#536e48" stopOpacity=".17" /><stop offset="100%" stopColor="#536e48" stopOpacity=".015" /></linearGradient></defs>
        {ticks.map(value => <g key={value}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} className="av-gridline" /><text x={left - 12} y={y(value) + 4} textAnchor="end" className="av-axis-label">{number.format(value)}</text></g>)}
        <motion.g key={revision} initial={reduced ? false : { opacity: .3 }} animate={{ opacity: 1 }} transition={{ duration: .35 }}>
          {fill && <path d={fill} fill={`url(#${id}-fill)`} />}
          {path && <motion.path d={path} className="av-line" fill="none" initial={reduced ? false : { pathLength: .94 }} animate={{ pathLength: 1 }} transition={{ duration: .55, ease: [.16, 1, .3, 1] }} />}
          {points.length === 1 && <circle cx={x(0)} cy={y(points[0].visits)} r="4" className="av-dot" />}
        </motion.g>
        {indexes.map((i, n) => <text key={i} x={x(i)} y={height - 8} textAnchor={n === 0 ? 'start' : n === indexes.length - 1 ? 'end' : 'middle'} className={`av-axis-label ${n % 2 === 1 ? 'av-axis-secondary' : ''}`}>{pointLabel(points[i], report.granularity)}</text>)}
        {chosen && <g><line x1={x(activeIndex)} x2={x(activeIndex)} y1={top} y2={height - bottom} className="av-crosshair" /><circle cx={x(activeIndex)} cy={y(chosen.visits)} r="5" className="av-dot" /></g>}
      </svg>
      {chosen && <div className="av-tooltip" style={{ left: `${Math.min(79, Math.max(21, x(activeIndex) / width * 100))}%`, top: `${Math.max(3, Math.min(58, y(chosen.visits) / height * 100 - 24))}%` }} aria-hidden="true"><span>{pointLabel(chosen, report.granularity, true)}{activeIndex === points.length - 1 ? ' · tot nu' : ''}</span><strong>Bezoeken: {number.format(chosen.visits)}</strong></div>}
    </div>
    <span className="sr-only" id={`${id}-selection`} aria-live={focused ? 'polite' : 'off'}>{chosen ? `${pointLabel(chosen, report.granularity, true)}: ${chosen.visits} bezoeken` : 'Alle cijfers zijn ook beschikbaar in de tabel hieronder.'}</span>
  </div>;
}

function Details({ report, onPage, loading }: { report: AnalyticsReport; onPage: (page: number) => void; loading: boolean }) {
  return <details className="av-details"><summary><ChevronDown size={15} />Toon cijfers per {report.period === '24h' ? 'uur' : 'dag'}</summary><div className="a-table-wrap"><table><caption className="sr-only">Websitebezoeken {rangeLabel(report)}</caption><thead><tr><th scope="col">{report.period === '24h' ? 'Uur vanaf' : 'Datum'}</th><th scope="col">Bezoeken</th></tr></thead><tbody>{report.details.map(p => <tr key={p.at}><th scope="row">{pointLabel(p, report.period === '24h' ? 'hour' : 'day', true)}</th><td>{number.format(p.visits)}</td></tr>)}</tbody></table></div>{report.pages > 1 && <div className="av-pagination"><button className="a-secondary" disabled={loading || report.page === 1} onClick={() => onPage(report.page - 1)} aria-label="Vorige pagina"><ChevronLeft size={16} /></button><span>Pagina {report.page} van {report.pages}</span><button className="a-secondary" disabled={loading || report.page === report.pages} onClick={() => onPage(report.page + 1)} aria-label="Volgende pagina"><ChevronRight size={16} /></button></div>}</details>;
}

export function Visitors() {
  const [selected, setSelected] = useState<Period>('7d'), [report, setReport] = useState<AnalyticsReport | null>(null);
  const [plan, setPlan] = useState<HostingPlan>();
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const current = useRef<AbortController | null>(null), version = useRef(0), mounted = useRef(false);
  const shown = useRef<AnalyticsReport | null>(null), selection = useRef<Period>('7d');
  const cache = useRef(new Map<Period, AnalyticsReport>()), reduced = useReducedMotion();
  const loadedAt = useRef(0);
  const load = useCallback(async (period: Period, page = 1, automatic = false, pagination = false) => {
    if (automatic && current.current) return;
    current.current?.abort(); const controller = new AbortController(); current.current = controller;
    const requestId = ++version.current; setLoading(true); setError('');
    const params = new URLSearchParams({ period, page: String(page) });
    if (pagination && shown.current?.period === period) {
      if (Date.now() - Date.parse(shown.current.to) < 14 * 60000) params.set('to', shown.current.to);
      else params.set('page', '1');
    }
    try {
      let response = await fetch(`/api/admin/analytics?${params}`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      if (response.status === 403 && period !== '24h' && period !== '7d') {
        if (!mounted.current || requestId !== version.current) return;
        selection.current = '7d'; period = '7d'; setSelected('7d'); setPlan('basis');
        cache.current.clear(); setReport(null); shown.current = null;
        response = await fetch('/api/admin/analytics?period=7d', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      }
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'De bezoekerscijfers konden niet worden geladen.');
      if (!mounted.current || requestId !== version.current) return;
      setPlan(result.plan);
      if (!hasExtendedAnalytics(result.plan)) cache.current.clear();
      loadedAt.current = Date.now(); setReport(result); shown.current = result; cache.current.set(period, result); setRevision(n => n + 1);
    } catch (e) { if (mounted.current && requestId === version.current && !controller.signal.aborted) setError((e as Error).message || 'De verbinding is onderbroken. Probeer opnieuw.'); }
    finally { if (mounted.current && requestId === version.current) { current.current = null; setLoading(false); } }
  }, []);
  useEffect(() => {
    mounted.current = true; setTarget(document.getElementById('av-header-target')); void load('7d');
    const revealNavigation = () => {
      if (window.innerWidth > 700) return;
      const button = document.querySelector<HTMLElement>('.a-sidebar nav button[aria-current="page"]');
      const nav = button?.closest('nav'); if (!nav || !button) return;
      const bounds = button.getBoundingClientRect(), parent = nav.getBoundingClientRect();
      if (bounds.right > parent.right || bounds.left < parent.left) nav.scrollBy({ left: bounds.left - parent.left - 15, behavior: 'instant' });
    };
    revealNavigation(); window.addEventListener('resize', revealNavigation);
    let lastRefresh = 0;
    const refresh = () => { const now = Date.now(); if (!document.hidden && now - lastRefresh > 1000 && now - loadedAt.current >= 60000) { lastRefresh = now; void load(selection.current, 1, true); } };
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { mounted.current = false; ++version.current; current.current?.abort(); current.current = null; window.removeEventListener('resize', revealNavigation); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [load]);
  const choose = (period: Period) => {
    if (!hasExtendedAnalytics(plan) && period !== '24h' && period !== '7d') return;
    if (selection.current === period) return;
    selection.current = period; setSelected(period);
    const cached = cache.current.get(period); const saved = cached && Date.now() - Date.parse(cached.updatedAt) < 60000 ? cached : null; setReport(saved); shown.current = saved;
    void load(period);
  };
  const refresh = () => { if (shown.current) shown.current = { ...shown.current, page: 1 }; void load(selection.current); };
  const headingActions = <div className="av-header-actions"><span className="av-updated"><Clock3 size={15} aria-hidden="true" />{report ? `Bijgewerkt ${day.format(date(report.updatedAt))}, ${hour.format(date(report.updatedAt))}` : 'Bezoekers ophalen'}</span><button className="a-button" disabled={loading} onClick={refresh}><RefreshCw size={16} className={loading ? 'av-spinning' : ''} aria-hidden="true" />Vernieuwen</button></div>;
  return <div className="av-root" data-loading={loading}>
    {target && createPortal(headingActions, target)}
    <div className="av-period"><span id="av-period-label">Periode</span><div className="av-period-options" role="group" aria-labelledby="av-period-label">{periods.map(([key, label]) => { const locked = !hasExtendedAnalytics(plan) && key !== '24h' && key !== '7d'; return <button key={key} aria-pressed={selected === key} aria-label={locked ? label + ', beschikbaar vanaf Pro' : label} title={locked ? 'Uitgebreide analytics zijn beschikbaar vanaf Pro' : undefined} disabled={locked} onClick={e => { choose(key); e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced ? 'instant' : 'smooth' }); }}>{label}{locked && <LockKeyhole size={12} aria-hidden="true" />}</button>; })}</div>{!hasExtendedAnalytics(plan) && <p className="av-period-note">Op Free zijn periodes tot en met 7 dagen beschikbaar. Uitgebreide analytics zijn beschikbaar vanaf Pro.</p>}<div className="av-range"><span>{report ? `${selected === 'all' ? 'Sinds de meetstart' : selected === 'year' ? 'Dit jaar' : `Afgelopen ${periods.find(([key]) => key === selected)![1]}`} · ${rangeLabel(report)}` : `Afgelopen ${periods.find(([key]) => key === selected)![1]}`}</span><span className={`av-load-indicator ${loading ? 'is-loading' : ''}`} aria-hidden="true"><i /><i /><i /></span></div></div>
    <div className="sr-only" role="status">{loading ? 'Bezoekerscijfers laden.' : error ? '' : 'Bezoekerscijfers bijgewerkt.'}</div>
    {error && <div className="av-error" role="alert"><Activity size={19} aria-hidden="true" /><div><strong>De cijfers konden niet worden bijgewerkt</strong><p>{error}</p></div><button className="a-secondary" onClick={refresh}>Opnieuw proberen</button></div>}
    <AnimatePresence mode="wait" initial={false}>
      {!report ? <motion.div key={`skeleton-${selected}`} initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .12 }}><Skeleton /></motion.div> :
        <motion.div key={`report-${selected}`} className={`av-report ${loading ? 'av-refreshing' : ''}`} aria-busy={loading} initial={reduced ? false : { opacity: .4, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .28, ease: [.16, 1, .3, 1] }}>
          <section className="av-panel av-chart-panel" aria-labelledby="av-chart-title"><div className="av-panel-heading"><div><h2 id="av-chart-title"><BarChart3 size={21} strokeWidth={1.7} aria-hidden="true" />Bezoeken doorheen de tijd</h2><p>Het aantal websitebezoeken per {report.granularity === 'hour' ? 'uur' : report.granularity === 'month' ? 'maand' : 'dag'}.</p></div></div>
            <Chart report={report} revision={revision} />
            {report.total === 0 && <p className="av-empty">{report.enabled ? 'Nog geen bezoeken in deze periode.' : 'De bezoekersmeting staat uit.'}</p>}
            <Details report={report} loading={loading} onPage={page => void load(selected, page, false, true)} />
          </section>
          <section className="av-panel av-device-panel" aria-labelledby="av-device-title"><div className="av-panel-heading"><div><h2 id="av-device-title"><Monitor size={21} strokeWidth={1.7} aria-hidden="true" />Apparaten</h2><p>Gebruik dit om prioriteiten voor mobiele en desktopervaringen te bepalen.</p></div></div><div className="av-devices">{report.devices.filter(d => d.device === 'desktop' || d.device === 'mobile' || d.visits > 0).map(d => <div className="av-device" key={d.device}><strong>{deviceNames[d.device]}</strong><span className="av-device-count"><b>{number.format(d.visits)}</b> {d.visits === 1 ? 'sessie' : 'sessies'}</span><div className="av-track" aria-hidden="true"><motion.span initial={reduced ? false : { scaleX: 0 }} animate={{ scaleX: report.total ? d.visits / report.total : 0 }} transition={{ duration: reduced ? 0 : .6, ease: [.16, 1, .3, 1] }} /></div><span className="av-percentage">{report.total ? `${(d.visits / report.total * 100).toLocaleString('nl-BE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : '—'}</span></div>)}</div></section>
        </motion.div>}
    </AnimatePresence>
  </div>;
}
