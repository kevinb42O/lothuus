import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trackHeart, syncHeartSelection, heartOrderContext } from './client';
const key='lothuus-heart-measurement';
test('automatic tracking: idle visits, offline retry, parallel clicks, pause, corrupt storage and fallback sessions', {timeout:10000},async()=>{
 const values=new Map<string,string>(), session=new Map<string,string>(), tails=new Map<string,Promise<unknown>>();
 const sent:{operation:string;browser:string;actions:{id:string;selected:boolean;baseline?:boolean;sequence:number}[]}[]=[];
 const originals=new Map(['navigator','localStorage','sessionStorage'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));const originalFetch=globalThis.fetch;
 const locks={request:async(name:string,arg:unknown,third?:unknown)=>{const cb=(third||arg) as (lock:unknown)=>unknown;if(third && tails.has(name))return cb(null);const previous=tails.get(name)||Promise.resolve();const result=previous.then(()=>cb({name}));const tail=result.then(()=>{},()=>{});tails.set(name,tail);try{return await result;}finally{if(tails.get(name)===tail)tails.delete(name);}}};
 const mapStorage=(map:Map<string,string>)=>({getItem:(k:string)=>map.get(k)||null,setItem:(k:string,v:string)=>map.set(k,v),removeItem:(k:string)=>map.delete(k)});
 Object.defineProperty(globalThis,'navigator',{value:{locks},configurable:true});Object.defineProperty(globalThis,'localStorage',{value:mapStorage(values),configurable:true});Object.defineProperty(globalThis,'sessionStorage',{value:mapStorage(session),configurable:true});
 let offline=false, enabled=true, pause:Promise<void>|null=null, release:()=>void=()=>{};
 globalThis.fetch=async(_url,options)=>{if(pause)await pause;if(offline)throw new Error('offline');sent.push(JSON.parse(String(options?.body)));return new Response(JSON.stringify({ok:true,enabled}),{status:200});};
 const tick=async()=>{for(let i=0;i<20;i++)await new Promise<void>(r=>setImmediate(r));};
 try{
  values.set('lothuus-heart-consent','no');await syncHeartSelection([]);assert.equal(sent.length,0);assert.equal(values.has(key),false);assert.equal(values.has('lothuus-heart-consent'),false);
  values.set('lothuus-selection',JSON.stringify(['K001']));await trackHeart('K001',true,[]);
  assert.equal(sent.length,1,'A click must not be followed by an empty sync.');
  assert.equal(sent.flatMap(r=>r.actions).filter(a=>a.id==='K001' && a.selected && !a.baseline).length,1);
  await syncHeartSelection(['K001']);await syncHeartSelection(['K001']);await syncHeartSelection(['K001']);assert.equal(sent.length,1,'An unchanged selection needs no repeated heartbeat.');
  const heartbeat=JSON.parse(values.get(key)!);heartbeat.checkedAt=Date.now()-24*60*60000-1;values.set(key,JSON.stringify(heartbeat));await syncHeartSelection(['K001']);assert.equal(sent.length,2);assert.equal(sent.at(-1)!.actions.length,0);
  offline=true;values.set('lothuus-selection','[]');await trackHeart('K001',false,['K001']);assert.ok(JSON.parse(values.get(key)!).actions.length>0);
  offline=false;await syncHeartSelection([]);assert.equal(JSON.parse(values.get(key)!).actions.length,0);assert.equal(sent.flatMap(r=>r.actions).filter(a=>a.id==='K001'&&!a.selected&&!a.baseline).length,1);
  pause=new Promise<void>(r=>{release=r;});values.set('lothuus-selection',JSON.stringify(['K002']));void trackHeart('K002',true,[]);await tick();
  const context=await heartOrderContext();assert.ok(context?.browser);assert.ok(context.sequence>0);
  values.set('lothuus-selection','[]');void trackHeart('K002',false,['K002']);await tick();assert.equal(JSON.parse(values.get(key)!).actions.length,2);
  release();pause=null;await tick();
  enabled=false;values.set('lothuus-selection',JSON.stringify(['K003']));await trackHeart('K003',true,[]);assert.equal(JSON.parse(values.get(key)!).needsBaseline,true);assert.equal(JSON.parse(values.get(key)!).actions.length,0);
  enabled=true;const before=sent.length;await syncHeartSelection(['K003']);const resumed=sent.slice(before).flatMap(r=>r.actions);assert.ok(resumed.some(a=>a.id==='K003' && a.selected && a.baseline));assert.ok(resumed.every(a=>a.baseline));
  const old=JSON.parse(values.get(key)!);old.actions=[{}];values.set(key,JSON.stringify(old));values.set('lothuus-selection',JSON.stringify(['K004']));await syncHeartSelection(['K004']);assert.ok(sent.at(-1)?.actions.every(a=>typeof a.id==='string'));
  // No Web Locks: a session-local journal still counts without racing another tab's queue.
  Object.defineProperty(globalThis,'navigator',{value:{},configurable:true});values.set('lothuus-selection',JSON.stringify(['K005']));const fallbacks=sent.length;await trackHeart('K005',true,[]);assert.ok(session.has(key));assert.ok(sent.slice(fallbacks).flatMap(r=>r.actions).some(a=>a.id==='K005'&&!a.baseline));
  // Storage-disabled browsers retain an in-memory selection/measurement for this visit.
  const blocked={getItem:()=>{throw new Error('blocked');},setItem:()=>{throw new Error('blocked');}};Object.defineProperty(globalThis,'sessionStorage',{value:blocked,configurable:true});const inMemory=sent.length;await trackHeart('K006',true,['K005']);assert.ok(sent.slice(inMemory).flatMap(r=>r.actions).some(a=>a.id==='K006'));
 }finally{globalThis.fetch=originalFetch;for(const [name,descriptor] of originals)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else Reflect.deleteProperty(globalThis,name);}
});
