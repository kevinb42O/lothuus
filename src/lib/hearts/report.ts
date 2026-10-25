import { availability, reservationLines, type Store } from '../backend/types';
import { catalogue } from '../backend/service';
import { heartDay, shiftDay, type HeartRaw, type HeartReport, type HeartRow } from './types';
export function buildHeartReport(raw: HeartRaw, store: Store, params: URLSearchParams, timestamp = Date.now()): HeartReport {
  const today = heartDay(timestamp), period = ['7', '30', '90', 'all'].includes(params.get('period') || '') ? params.get('period')! : '30';
  const days = period === 'all' ? 0 : Number(period);
  const retainedFrom = shiftDay(today, -730), start = heartDay(raw.startedAt);
  const requestedFrom = days ? shiftDay(today, 1 - days) : retainedFrom;
  const from = [requestedFrom, start, retainedFrom].sort().at(-1)!;
  const selected = params.get('object') || '', query = (params.get('q') || '').slice(0, 150).toLocaleLowerCase('nl');
  const category = params.get('category') || '', status = params.get('status') || '', sort = params.get('sort') || 'added';
  const series: HeartReport['series'] = [];
  for (let day = from; day <= today; day = shiftDay(day, 1)) series.push({ day, added: 0, removed: 0, ordered: 0 });
  const dayMap = new Map(series.map(d => [d.day, d]));
  const current = new Map(catalogue(store).objects.map(o => [o.id, o]));
  const rows: HeartRow[] = raw.objects.map(o => {
    const product = store.items.find(i => i.id === o.id || i.sourceReference === o.id), live = current.get(o.id);
    const hist = raw.days.filter(d => d.id === o.id), inPeriod = hist.filter(d => d.day >= from && d.day <= today);
    const recent = raw.recent.find(r => r.id === o.id);
    const orders = store.reservations.filter(r => r.source === 'web' && heartDay(r.createdAt) >= from && heartDay(r.createdAt) <= today && reservationLines(r).some(l => l.itemId === o.id || !!product && l.itemId === product.id));
    const latest = hist.filter(d => d.added > 0).map(d => d.day).sort().at(-1);
    return { ...o, title: product?.title || live?.title || o.title, reference: product?.productNumber || o.reference, image: product?.photos[0] ? `/api/images/${product.photos[0].id}?size=thumb` : live?.image || o.image, category: product?.category || o.category, availability: product?.publication === 'archived' ? 'archived' : live?.availability || (product ? availability(store, product.id) : 'missing'), itemId: product?.id, added: inPeriod.reduce((n,d) => n+d.added,0), removed: inPeriod.reduce((n,d) => n+d.removed,0), ordered: inPeriod.reduce((n,d) => n+d.ordered,0), recent: recent?.count || 0, lastSeen: latest || null, reservations: orders.length, cancelled: orders.filter(r => r.status === 'cancelled' || r.status === 'expired').length };
  });
  const categories = [...new Set(rows.map(r => r.category))].sort();
  const relevant = rows.filter(r => (!query || `${r.title} ${r.reference} ${r.id}`.toLocaleLowerCase('nl').includes(query)) && (!category || r.category === category) && (!status || r.availability === status));
  const ids = new Set(relevant.filter(r => !selected || r.id === selected).map(r => r.id));
  for (const d of raw.days) if (ids.has(d.id)) { const target = dayMap.get(d.day); if (target) { target.added += d.added; target.removed += d.removed; target.ordered += d.ordered; } }
  const display = relevant.filter(r => !selected || r.id === selected);
  const totals = { added: series.reduce((n,d) => n+d.added,0), removed: series.reduce((n,d) => n+d.removed,0), objects: display.filter(r => r.added > 0).length };
  // Compare equal complete calendar windows, excluding the partial current day.
  const window = Math.max(0, days - 1), previousFrom = shiftDay(from, -window);
  const comparable = !!window && start < previousFrom;
  const previousAdded = comparable ? raw.days.filter(d => ids.has(d.id) && d.day >= previousFrom && d.day < from).reduce((n,d) => n+d.added,0) : 0;
  relevant.sort((a,b) => sort === 'recent' ? b.recent-a.recent || b.added-a.added : sort === 'latest' ? (b.lastSeen || '').localeCompare(a.lastSeen || '') : b.added-a.added || b.recent-a.recent || a.reference.localeCompare(b.reference,'nl',{numeric:true}));
  const pages = Math.max(1, Math.ceil(relevant.length/25)), page = Math.min(pages, Math.max(1, Math.floor(Number(params.get('page'))) || 1));
  return { enabled: raw.enabled, startedAt: raw.startedAt, updatedAt: new Date(timestamp).toISOString(), from, to: today, comparable, previousAdded, totals, series, rows: relevant.slice((page-1)*25,page*25), totalRows: relevant.length, page, pages, categories, detail: rows.find(r => r.id === selected) || null };
}
