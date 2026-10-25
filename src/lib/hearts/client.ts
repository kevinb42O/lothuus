'use client';
import type { HeartAction } from './types';
const key = 'lothuus-heart-measurement';
export const consentKey = 'lothuus-heart-consent';
type Journal = { browser: string; sequence: number; seenAt: number; actions: HeartAction[]; known: string[]; queuedAt?: number };
function read(): Journal | null {
  try {
    const j = JSON.parse(localStorage.getItem(key) || 'null');
    return j && typeof j.browser === 'string' && Number.isSafeInteger(j.sequence) && typeof j.seenAt === 'number' && Array.isArray(j.actions) && Array.isArray(j.known) ? j : null;
  } catch { return null; }
}
function save(j: Journal) { j.seenAt = Date.now(); localStorage.setItem(key, JSON.stringify(j)); }
function sequence(j: Journal) { return j.sequence = Math.max(j.sequence + 1, Date.now() * 1000); }
async function locked<T>(work: () => Promise<T> | T): Promise<T | undefined> {
  // No tracking without cross-tab locking; local favourites still work normally.
  if (typeof navigator === 'undefined' || !navigator.locks) return;
  return navigator.locks.request('lothuus-heart-journal', work);
}
function selectedIds() {
  try { const v = JSON.parse(localStorage.getItem('lothuus-selection') || '[]'); return Array.isArray(v) ? v.filter((id): id is string => typeof id === 'string').slice(0,500) : []; }
  catch { return []; }
}
async function send(body: unknown) {
  const res = await fetch('/api/hearts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error('Hartjes synchroniseren is tijdelijk niet mogelijk.');
}
function journal(ids: string[]) {
  let j = read();
  if (!j || j.seenAt < Date.now()-90*86400000) {
    j = { browser: crypto.randomUUID(), sequence: Date.now()*1000, seenAt: Date.now(), actions: [], known: ids };
    for (const id of ids) j.actions.push({ id, selected: true, baseline: true, sequence: sequence(j) });
  }
  return j;
}
function boundQueue(j: Journal, ids: string[]) {
  if ((j.queuedAt || Date.now()) < Date.now()-86400000 || j.actions.length > 1000) {
    const all = new Set([...j.actions.map(a=>a.id),...j.known,...ids]);
    j.actions = [...all].slice(0,1000).map(id=>({ id, selected: ids.includes(id), baseline: true, sequence: sequence(j) }));
    j.queuedAt = Date.now();
  }
}
async function flush() {
  if (!navigator.locks) return;
  // Delivery never holds the journal lock across network I/O. New clicks are persisted immediately.
  await navigator.locks.request('lothuus-heart-delivery', { ifAvailable: true }, async lock => {
    if (!lock) return;
    for (let batch=0;batch<10;batch++) {
      const snapshot = await locked(()=>localStorage.getItem(consentKey)==='yes'?read():null);
      if (!snapshot) return;
      const actions = snapshot.actions.slice(0,100);
      await send({ operation: 'sync', browser: snapshot.browser, actions });
      await locked(()=>{
        const current=read(); if(!current || current.browser!==snapshot.browser)return;
        const delivered=new Set(actions.map(a=>a.sequence)); current.actions=current.actions.filter(a=>!delivered.has(a.sequence));
        if(!current.actions.length)delete current.queuedAt;save(current);
      });
      if (!actions.length) return;
    }
  });
}
export async function syncHeartSelection(_ids: string[]) {
  try {
    await locked(()=>{
      if(localStorage.getItem(consentKey)!=='yes')return;
      // Read inside the lock, so a delayed storage event cannot replay an old selection.
      const ids=selectedIds(), j=journal(ids);
      for(const id of new Set([...j.known,...ids])) if(j.known.includes(id)!==ids.includes(id)) j.actions.push({ id, selected: ids.includes(id), baseline: true, sequence: sequence(j) });
      j.known=ids;boundQueue(j,ids);save(j);
    });
    await flush();
  } catch { /* The durable journal retries on focus, online, or the next refresh. */ }
}
export async function trackHeart(id: string, selected: boolean, previousIds: string[]) {
  try {
    await locked(()=>{
      if(localStorage.getItem(consentKey)!=='yes')return;
      const j=journal(previousIds);j.queuedAt ||= Date.now();
      j.known=selected?[...new Set([...j.known,id])]:j.known.filter(v=>v!==id);
      j.actions.push({ id, selected, sequence: sequence(j) });boundQueue(j,j.known);save(j);
    });
    await flush();
  } catch { /* Saving the local selection does not depend on analytics. */ }
}
export async function heartOrderContext() {
  try {
    // Do not wait for delivery before checkout: an analytics outage must not block ordering.
    return await locked(()=>{
      if(localStorage.getItem(consentKey)!=='yes')return;
      const j=read();if(!j)return;const seq=sequence(j);save(j);return { browser:j.browser,sequence:seq };
    });
  } catch { return; }
}
export async function setHeartConsent(allowed: boolean) {
  localStorage.setItem(consentKey,allowed?'yes':'no');
  if(allowed){void syncHeartSelection(selectedIds());return;}
  const browser=await locked(()=>{const j=read();if(!j)return;j.actions=[];save(j);return j.browser;});
  if(!browser || !navigator.locks)return;
  await navigator.locks.request('lothuus-heart-delivery',async()=>{
    await send({operation:'forget',browser});
    await locked(()=>{if(read()?.browser===browser && localStorage.getItem(consentKey)==='no')localStorage.removeItem(key);});
  });
}
export async function retryHeartForget() {
  try {if(localStorage.getItem(consentKey)==='no' && read())await setHeartConsent(false);}catch{}
}
