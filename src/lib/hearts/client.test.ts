import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trackHeart, syncHeartSelection, setHeartConsent, heartOrderContext, consentKey } from './client';
test('durable client queue, baseline, offline recovery, nonblocking checkout and withdrawal',async()=>{
 const values=new Map<string,string>(), tails=new Map<string,Promise<unknown>>(), sent:{operation:string;actions?:{id:string;selected:boolean;baseline?:boolean}[]}[]=[];
 const originalNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator'), originalStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage'), originalFetch=globalThis.fetch;
 const locks={request:async(name:string,arg:unknown,third?:unknown)=>{const cb=(third||arg) as (lock:unknown)=>unknown;if(third && tails.has(name))return cb(null);const previous=tails.get(name)||Promise.resolve();const result=previous.then(()=>cb({name}));const tail=result.then(()=>{},()=>{});tails.set(name,tail);try{return await result;}finally{if(tails.get(name)===tail)tails.delete(name);}}};
 Object.defineProperty(globalThis,'navigator',{value:{locks},configurable:true});
 Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>values.get(k)||null,setItem:(k:string,v:string)=>values.set(k,v),removeItem:(k:string)=>values.delete(k)},configurable:true});
 let offline=false, pause:Promise<void>|null=null, release:()=>void=()=>{};
 globalThis.fetch=async(_url,options)=>{if(pause)await pause;if(offline)throw new Error('offline');sent.push(JSON.parse(String(options?.body)));return new Response(JSON.stringify({ok:true}),{status:200});};
 const tick=async()=>{for(let i=0;i<20;i++)await new Promise<void>(r=>setImmediate(r));};
 try{
  await trackHeart('K001',true,[]);assert.equal(values.has('lothuus-heart-measurement'),false);
  values.set('lothuus-selection',JSON.stringify(['K001']));await setHeartConsent(true);await tick();
  assert.ok(sent.some(r=>r.actions?.some(a=>a.id==='K001' && a.baseline)));
  offline=true;values.set('lothuus-selection','[]');await trackHeart('K001',false,['K001']);
  assert.ok(JSON.parse(values.get('lothuus-heart-measurement')!).actions.length>0);
  offline=false;await syncHeartSelection([]);assert.equal(JSON.parse(values.get('lothuus-heart-measurement')!).actions.length,0);
  assert.equal(sent.flatMap(r=>r.actions||[]).filter(a=>a.id==='K001'&&!a.selected&&!a.baseline).length,1);
  pause=new Promise<void>(r=>{release=r;});values.set('lothuus-selection',JSON.stringify(['K002']));void trackHeart('K002',true,[]);await tick();
  const context=await heartOrderContext();assert.ok(context?.browser);assert.ok(context.sequence>0);
  // A second click is persisted while delivery is still waiting on the network.
  values.set('lothuus-selection','[]');void trackHeart('K002',false,['K002']);await tick();assert.equal(JSON.parse(values.get('lothuus-heart-measurement')!).actions.length,2);
  release();pause=null;await tick();await setHeartConsent(false);assert.equal(values.get(consentKey),'no');assert.equal(values.has('lothuus-heart-measurement'),false);assert.equal(sent.at(-1)?.operation,'forget');
 }finally{globalThis.fetch=originalFetch;if(originalNavigator)Object.defineProperty(globalThis,'navigator',originalNavigator);else Reflect.deleteProperty(globalThis,'navigator');if(originalStorage)Object.defineProperty(globalThis,'localStorage',originalStorage);else Reflect.deleteProperty(globalThis,'localStorage');}
});
