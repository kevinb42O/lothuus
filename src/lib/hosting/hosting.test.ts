import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { HOSTING_BANK, PLANS, PRODUCTS, objectUsage, paymentPayload } from './catalogue';
import { hostingCommand } from './server';
import { localCommand, localReport } from './local';
test('agreed quotas, exact prices and independent expansion quantities',()=>{
 assert.deepEqual(Object.values(PLANS).map(p=>p.name),['Free','Pro','Enterprise']);
 assert.deepEqual(Object.values(PLANS).map(p=>p.objects),[200,500,1000]);
 assert.deepEqual(Object.values(PRODUCTS).map(p=>p.cents),[2500,5000,2500,24000,4900,49000]);
 assert.equal(objectUsage(205,200).over,5);assert.ok(Math.abs(objectUsage(205,200).percentage-102.5)<1e-10);assert.equal(objectUsage(205,200).fill,100);assert.equal(objectUsage(205,200).tone,'danger');
 assert.equal(objectUsage(200,200).over,0);assert.equal(objectUsage(200,200).tone,'danger');assert.equal(objectUsage(159,200).tone,'normal');assert.equal(objectUsage(160,200).tone,'warning');assert.equal(objectUsage(195,200).over,0);
});
test('bank payloads retain every original field and historical reference',()=>{
 assert.equal(HOSTING_BANK.iban,'BE43738004886701');
 for(const [key,p] of Object.entries(PRODUCTS)){
 const lines=paymentPayload(key as keyof typeof PRODUCTS).split('\n');
 assert.deepEqual(lines.slice(0,7),['BCD','002','1','SCT','','Kevin Bourguignon','BE43738004886701']);assert.equal(lines[7],`EUR${(p.cents/100).toFixed(2)}`);assert.equal(lines[8],'');assert.equal(lines[9],p.bankLabel);assert.equal(lines.length,10);
 }
});
test('owner inputs cannot choose a price, quota or activation status',()=>{
 const key=randomUUID();assert.equal(hostingCommand.safeParse({action:'order',key,product:'extra50',cents:1}).success,false);assert.equal(hostingCommand.safeParse({action:'status',id:key,status:'active'}).success,false);assert.equal(hostingCommand.safeParse({action:'order',key,product:'basis'}).success,false);
});
test('isolated order retry, conflicts and payment claims never grant capacity',()=>{
 const dir=mkdtempSync(join(tmpdir(),'lothuus-hosting-')),previous=process.env.LOTHUUS_DATA_DIR;process.env.LOTHUUS_DATA_DIR=dir;
 try{const key=randomUUID();localCommand({action:'order',key,product:'extra50'});localCommand({action:'order',key,product:'extra50'});assert.equal(localReport().orders.length,1);assert.throws(()=>localCommand({action:'order',key,product:'extra150'}));localCommand({action:'status',id:key,status:'payment_review'});assert.equal(localReport().orders[0].status,'payment_review');assert.equal(localReport().limit,200);localCommand({action:'status',id:key,status:'cancelled'});assert.equal(localReport().orders[0].status,'payment_review');assert.equal(localReport().limit,200);}finally{if(previous===undefined)delete process.env.LOTHUUS_DATA_DIR;else process.env.LOTHUUS_DATA_DIR=previous;rmSync(dir,{recursive:true,force:true});}
});
test('hosting and scheduler routes reject unauthenticated and cross-origin requests',async()=>{
 const {NextRequest}=await import('next/server');const routes=await import('../../app/api/admin/hosting/route');const cron=await import('../../app/api/cron/hosting/route');
 const dir=mkdtempSync(join(tmpdir(),'lothuus-hosting-auth-')),previous=process.env.LOTHUUS_DATA_DIR,mode=process.env.BACKEND_MODE;process.env.LOTHUUS_DATA_DIR=dir;process.env.BACKEND_MODE='local';
 try{const get=await routes.GET(new NextRequest('http://localhost/api/admin/hosting'));assert.equal(get.status,401);const post=await routes.POST(new NextRequest('http://localhost/api/admin/hosting',{method:'POST',headers:{origin:'https://other.example'},body:'{}'}));assert.equal(post.status,403);const c=await cron.GET(new NextRequest('http://localhost/api/cron/hosting'));assert.equal(c.status,401);}finally{if(previous===undefined)delete process.env.LOTHUUS_DATA_DIR;else process.env.LOTHUUS_DATA_DIR=previous;if(mode===undefined)delete process.env.BACKEND_MODE;else process.env.BACKEND_MODE=mode;rmSync(dir,{recursive:true,force:true});}
});
test('an over-limit collection stays editable while new records roll back',async()=>{
 const {withStore}=await import('../backend/cloud');const {transact}=await import('../backend/repository');const dir=mkdtempSync(join(tmpdir(),'lothuus-hosting-limit-')),previous=process.env.LOTHUUS_DATA_DIR,mode=process.env.BACKEND_MODE;process.env.LOTHUUS_DATA_DIR=dir;process.env.BACKEND_MODE='local';
 try{transact(s=>{s.items=Array.from({length:199},(_,n)=>({id:String(n),title:'Bestaand object',photos:[],publication:'archived'} as unknown as typeof s.items[number]));});await withStore(s=>{s.items[0].title='Bijgewerkt';});assert.equal(transact(s=>s.items[0].title),'Bijgewerkt');await withStore(s=>{s.items.push({...s.items[0],id:'laatste'});});assert.equal(transact(s=>s.items.length),200);await assert.rejects(withStore(s=>{s.items.push({...s.items[0],id:'nieuw'});}),/objectlimiet/);assert.equal(transact(s=>s.items.length),200);}finally{if(previous===undefined)delete process.env.LOTHUUS_DATA_DIR;else process.env.LOTHUUS_DATA_DIR=previous;if(mode===undefined)delete process.env.BACKEND_MODE;else process.env.BACKEND_MODE=mode;rmSync(dir,{recursive:true,force:true});}
});
test('Free analytics endpoints reject historical periods even with an owner session',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'lothuus-plan-access-'));
 const previous={data:process.env.LOTHUUS_DATA_DIR,mode:process.env.BACKEND_MODE,password:process.env.ADMIN_PASSWORD};
 process.env.LOTHUUS_DATA_DIR=dir;process.env.BACKEND_MODE='local';process.env.ADMIN_PASSWORD=randomUUID();
 try {
  const {NextRequest}=await import('next/server');
  const {authenticate}=await import('../backend/local-auth');
  const cookie=`lothuus-owner=${authenticate(process.env.ADMIN_PASSWORD)}`;
  const visitors=await import('../../app/api/admin/analytics/route');
  const hearts=await import('../../app/api/admin/hearts/route');
  for(const period of ['30d','3m','12m','year','all']) {
   const r=await visitors.GET(new NextRequest(`http://localhost/api/admin/analytics?period=${period}`,{headers:{cookie}}));
   assert.equal(r.status,403,period);
  }
  for(const period of ['24h','7d']) {
   const r=await visitors.GET(new NextRequest(`http://localhost/api/admin/analytics?period=${period}`,{headers:{cookie}}));
   assert.equal(r.status,200);assert.equal((await r.json()).plan,'basis');
  }
  for(const period of ['30','90','all','invalid']) {
   const r=await hearts.GET(new NextRequest(`http://localhost/api/admin/hearts?period=${period}`,{headers:{cookie}}));
   assert.equal(r.status,403,period);
  }
  const r=await hearts.GET(new NextRequest('http://localhost/api/admin/hearts',{headers:{cookie}}));
  assert.equal(r.status,200);const report=await r.json();assert.equal(report.plan,'basis');assert.ok(report.series.length<=7);assert.equal(report.previousAdded,0);assert.equal(report.comparable,false);
  const {hasExtendedAnalytics}=await import('./access');
  assert.equal(hasExtendedAnalytics('pro'),true);assert.equal(hasExtendedAnalytics('premium'),true);assert.equal(hasExtendedAnalytics('basis'),false);assert.equal(hasExtendedAnalytics(undefined),false);
 }finally{
  for(const [key,value] of Object.entries({LOTHUUS_DATA_DIR:previous.data,BACKEND_MODE:previous.mode,ADMIN_PASSWORD:previous.password}))if(value===undefined)delete process.env[key];else process.env[key]=value;
  rmSync(dir,{recursive:true,force:true});
 }
});
