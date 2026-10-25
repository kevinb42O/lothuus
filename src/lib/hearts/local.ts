import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { dataDirectory } from '../backend/repository';
import { heartDay, monthsBefore, type HeartAction, type HeartObject, type HeartRaw } from './types';
export type LocalHearts = HeartRaw & { browsers: Record<string, { seenAt: string; states: Record<string, { selected: boolean; sequence: number }> }> };
export function initialHearts(): LocalHearts { return { enabled: true, startedAt: new Date().toISOString(), objects: [], days: [], recent: [], browsers: {} }; }
export function cleanHearts(s: LocalHearts, timestamp = Date.now()) {
  for (const [key, browser] of Object.entries(s.browsers)) if (Date.parse(browser.seenAt) < timestamp - 90 * 86400000) delete s.browsers[key];
  s.days = s.days.filter(d => d.day >= monthsBefore(heartDay(timestamp),24));
}
export function writeHearts(s: LocalHearts, key: string, actions: (HeartAction & { object: HeartObject | null })[], timestamp = Date.now()) {
  cleanHearts(s, timestamp); if (!s.enabled) return;
  const browser = s.browsers[key] ||= { seenAt: new Date(timestamp).toISOString(), states: {} }; browser.seenAt = new Date(timestamp).toISOString();
  for (const a of actions) {
    const old = browser.states[a.id]; if (old && old.sequence >= a.sequence) continue;
    if (a.object) s.objects = [...s.objects.filter(o => o.id !== a.id), a.object];
    else if (a.selected || !s.objects.some(o => o.id === a.id)) continue;
    if (!a.baseline && (old?.selected || false) !== a.selected) {
      let day = s.days.find(d => d.id === a.id && d.day === heartDay(timestamp));
      if (!day) { day = { day: heartDay(timestamp), id: a.id, added: 0, removed: 0, ordered: 0 }; s.days.push(day); }
      day[a.selected ? 'added' : 'removed']++;
    }
    browser.states[a.id] = { selected: a.selected, sequence: a.sequence };
  }
}
export function orderHearts(s: LocalHearts, key: string, objects: HeartObject[], seq: number, timestamp = Date.now()) {
  if (!s.enabled || !objects.length) return;
  const browser=s.browsers[key] ||= { seenAt:new Date(timestamp).toISOString(),states:{} };browser.seenAt=new Date(timestamp).toISOString();
  for(const object of objects){
    const old=browser.states[object.id];if(old && old.sequence>=seq)continue;
    if(!s.objects.some(o=>o.id===object.id))s.objects.push(object);
    browser.states[object.id]={selected:false,sequence:seq};
    if(!old?.selected)continue;
    let day=s.days.find(d=>d.id===object.id && d.day===heartDay(timestamp));
    if(!day){day={id:object.id,day:heartDay(timestamp),added:0,removed:0,ordered:0};s.days.push(day);}day.ordered++;
  }
}
export function localHearts<T>(fn: (state: LocalHearts) => T): T {
  mkdirSync(dataDirectory(), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(join(dataDirectory(), 'hearts.sqlite'));
  try {
    db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS hearts (id INTEGER PRIMARY KEY, body TEXT NOT NULL); BEGIN IMMEDIATE;');
    const row = db.prepare('SELECT body FROM hearts WHERE id=1').get() as { body: string } | undefined;
    const state: LocalHearts = row ? JSON.parse(row.body) : initialHearts(); cleanHearts(state);
    const result = fn(state);
    db.prepare('INSERT INTO hearts(id,body) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body').run(JSON.stringify(state)); db.exec('COMMIT'); return result;
  } catch (e) { try { db.exec('ROLLBACK'); } catch {} throw e; } finally { db.close(); }
}
