'use client';
import { heartDay, type HeartAction } from './types';
const key = 'lothuus-heart-measurement';
type Journal = { browser: string; sequence: number; seenAt: number; actions: HeartAction[]; known: string[]; queuedAt?: number; needsBaseline?: boolean; checkedAt?: number };
const heartbeat = 24 * 60 * 60000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let memory: Journal | null = null, fallbackTail: Promise<unknown> = Promise.resolve(), delivering = false;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 128;
const safeSequence = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) < Number.MAX_SAFE_INTEGER - 10000;
function storage() { return navigator.locks ? localStorage : sessionStorage; }
function read(): Journal | null {
  let j: Journal | null;
  try { j = JSON.parse(storage().getItem(key) || 'null'); } catch { j = memory; }
  if (!j || !uuid.test(j.browser) || !safeSequence(j.sequence) || !Number.isFinite(j.seenAt) || !Array.isArray(j.known) || j.known.length > 1000 || !j.known.every(id) || !Array.isArray(j.actions) || j.actions.length > 1000) return null;
  if (!j.actions.every(a => a && id(a.id) && typeof a.selected === 'boolean' && safeSequence(a.sequence) && (a.baseline === undefined || typeof a.baseline === 'boolean'))) return null;
  return j;
}
function save(j: Journal) { j.seenAt = Date.now(); memory = j; try { storage().setItem(key, JSON.stringify(j)); } catch { /* Private browsing uses an in-memory session. */ } }
function sequence(j: Journal) { return j.sequence = Math.max(j.sequence + 1, Date.now() * 1000); }
async function locked<T>(work: () => T): Promise<T> {
  if (navigator.locks) return navigator.locks.request('lothuus-heart-journal', work);
  // A tab/session-local journal avoids unsafe shared writes when Web Locks is unavailable.
  const result = fallbackTail.then(work); fallbackTail = result.catch(() => undefined); return result;
}
function selectedIds(fallback: string[]) {
  try { const raw = localStorage.getItem('lothuus-selection'); if (!raw) return fallback; const v = JSON.parse(raw); return Array.isArray(v) ? v.filter(id).slice(0,500) : fallback; }
  catch { return fallback; }
}
async function send(j: Journal, actions: HeartAction[]) {
  const res = await fetch('/api/hearts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation:'sync', browser:j.browser, actions }), signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error('Hartjes synchroniseren is tijdelijk niet mogelijk.');
  return res.json() as Promise<{ enabled?: boolean; excluded?: boolean }>;
}
function journal(ids: string[]): Journal {
  let j = read();
  if (!j || j.seenAt < Date.now()-90*86400000) {
    j = { browser: crypto.randomUUID(), sequence: Date.now()*1000, seenAt: Date.now(), actions: [], known: ids };
    for (const object of ids) j.actions.push({ id:object, selected:true, baseline:true, sequence:sequence(j) });
  }
  return j;
}
function baseline(j: Journal, ids: string[]) {
  const all = new Set([...j.actions.map(a=>a.id),...j.known,...ids]);
  j.actions = [...all].slice(0,1000).map(object=>({ id:object, selected:ids.includes(object), baseline:true, sequence:sequence(j) }));
  j.known = ids; j.queuedAt = Date.now();
}
function boundQueue(j: Journal, ids: string[]) {
  if (j.needsBaseline || j.queuedAt && heartDay(j.queuedAt)!==heartDay(Date.now()) || j.actions.length > 900) baseline(j,ids);
}
async function deliver() {
  for (let batch=0;batch<10;batch++) {
    const snapshot = await locked(()=>read()); if(!snapshot)return;
    const actions = snapshot.actions.slice(0,100);
    const elapsed = Date.now() - (snapshot.checkedAt || 0);
    if (!actions.length && (!snapshot.known.length || elapsed >= 0 && elapsed < heartbeat)) return;
    const response = await send(snapshot, actions);
    const remaining = await locked(()=>{
      const current=read(); if(!current || current.browser!==snapshot.browser)return;
      if(response.enabled===false || response.excluded){current.actions=[];current.needsBaseline=true;}
      else { const delivered=new Set(actions.map(a=>a.sequence));current.actions=current.actions.filter(a=>!delivered.has(a.sequence));current.needsBaseline=false; }
      current.checkedAt = Date.now();
      if(!current.actions.length)delete current.queuedAt;save(current);
      return current.actions.length;
    });
    if(!remaining || response.enabled===false || response.excluded)return;
  }
}
async function flush() {
  if(navigator.locks)await navigator.locks.request('lothuus-heart-delivery',{ifAvailable:true},async lock=>{if(lock)await deliver();});
  else if(!delivering){delivering=true;try{await deliver();}finally{delivering=false;}}
}
export async function syncHeartSelection(currentIds: string[]) {
  try {
    await locked(()=>{
      // Remove the obsolete setting. Tracking no longer depends on an opt-in checkbox.
      try { localStorage.removeItem('lothuus-heart-consent'); } catch {}
      const ids=selectedIds(currentIds);if(!read() && !ids.length)return;
      const j=journal(ids);
      for(const object of new Set([...j.known,...ids]))if(j.known.includes(object)!==ids.includes(object))j.actions.push({id:object,selected:ids.includes(object),baseline:true,sequence:sequence(j)});
      j.known=ids;boundQueue(j,ids);save(j);
    });
    await flush();
  } catch { /* Retry the durable journal on focus, online, or the next refresh. */ }
}
export async function trackHeart(object: string, selected: boolean, previousIds: string[]) {
  try {
    await locked(()=>{
      const j=journal(previousIds);j.queuedAt ||= Date.now();
      j.known=selected?[...new Set([...j.known,object])]:j.known.filter(v=>v!==object);
      j.actions.push({id:object,selected,sequence:sequence(j)});boundQueue(j,j.known);save(j);
    });await flush();
  } catch { /* A measurement outage cannot prevent local favourites. */ }
}
export async function heartOrderContext() {
  try {return await locked(()=>{const j=read();if(!j)return;const seq=sequence(j);save(j);return{browser:j.browser,sequence:seq};});}
  catch{return;}
}
