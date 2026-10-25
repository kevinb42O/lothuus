import test from 'node:test';
import assert from 'node:assert/strict';
import { act, type ReactNode } from 'react';
import { createRequire } from 'node:module';
import { setupDom, settle, button } from '../../test/dom';
import type { AnalyticsReport } from '../../lib/analytics/types';

test('switching back to an old paginated period starts a fresh snapshot',async()=>{
 const ui=setupDom(),originalFetch=globalThis.fetch,originalNow=Date.now,observer=Object.getOwnPropertyDescriptor(globalThis,'ResizeObserver');
 let now=Date.now();Date.now=()=>now;
 Object.defineProperty(globalThis,'ResizeObserver',{configurable:true,value:class {observe(){}disconnect(){}}});
 const require=createRequire(import.meta.url),motion=require('motion/react'),motionModule=require.cache[require.resolve('motion/react')]!,originalMotion=motionModule.exports;
 motionModule.exports={...motion,AnimatePresence:({children}:{children:ReactNode})=>children};
 const {createRoot}=await import('react-dom/client');const {Visitors}=await import('./visitors');const root=createRoot(ui.container);
 const requests:URLSearchParams[]=[];
 globalThis.fetch=async input=>{
  const params=new URL(String(input),'http://localhost').searchParams;requests.push(params);
  const period=params.get('period')||'7d',to=params.get('to')||new Date(now).toISOString();
  const report={enabled:true,startedAt:'2026-01-01T00:00:00Z',updatedAt:to,from:'2026-01-01T00:00:00Z',to,period,granularity:'day',total:1,points:[{at:'2026-10-25',visits:1}],details:[{at:'2026-10-25',visits:1}],page:Number(params.get('page')||1),pages:period==='3m'?2:1,detailCount:period==='3m'?100:7,devices:[{device:'desktop',visits:1},{device:'mobile',visits:0}],plan:'pro'};
  return Response.json(report as AnalyticsReport);
 };
 try{
  await act(async()=>{root.render(<Visitors/>);await settle();await settle();});
  await act(async()=>{button(ui.container,'3 maanden').click();await settle();await settle();});
  await act(async()=>{ui.container.querySelector<HTMLButtonElement>('[aria-label="Volgende pagina"]')!.click();await settle();});
  assert.ok(requests.at(-1)!.has('to'));const old=requests.at(-1)!.get('to');
  await act(async()=>{button(ui.container,'7 dagen').click();await settle();});
  now+=16*60000;
  await act(async()=>{button(ui.container,'3 maanden').click();await settle();await settle();});
  assert.equal(requests.at(-1)!.get('period'),'3m');assert.equal(requests.at(-1)!.has('to'),false);assert.notEqual(new Date(now).toISOString(),old);
 }finally{await act(async()=>root.unmount());motionModule.exports=originalMotion;globalThis.fetch=originalFetch;Date.now=originalNow;if(observer)Object.defineProperty(globalThis,'ResizeObserver',observer);else Reflect.deleteProperty(globalThis,'ResizeObserver');ui.cleanup();}
});
