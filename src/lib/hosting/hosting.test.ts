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
 assert.deepEqual(Object.values(PLANS).map(p=>p.objects),[150,300,500]);
 assert.deepEqual(Object.values(PRODUCTS).map(p=>p.cents),[2500,5000,2500,24000,4900,49000]);
 assert.equal(objectUsage(195,150).over,45);assert.equal(objectUsage(195,150).percentage,130);assert.equal(objectUsage(195,150).fill,100);assert.equal(objectUsage(195,150).tone,'danger');
 assert.equal(objectUsage(150,150).over,0);assert.equal(objectUsage(150,150).tone,'danger');assert.equal(objectUsage(119,150).tone,'normal');assert.equal(objectUsage(120,150).tone,'warning');assert.equal(objectUsage(195,200).over,0);
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
 try{const key=randomUUID();localCommand({action:'order',key,product:'extra50'});localCommand({action:'order',key,product:'extra50'});assert.equal(localReport().orders.length,1);assert.throws(()=>localCommand({action:'order',key,product:'extra150'}));localCommand({action:'status',id:key,status:'payment_review'});assert.equal(localReport().orders[0].status,'payment_review');assert.equal(localReport().limit,150);localCommand({action:'status',id:key,status:'cancelled'});assert.equal(localReport().orders[0].status,'payment_review');assert.equal(localReport().limit,150);}finally{if(previous===undefined)delete process.env.LOTHUUS_DATA_DIR;else process.env.LOTHUUS_DATA_DIR=previous;rmSync(dir,{recursive:true,force:true});}
});
test('hosting and scheduler routes reject unauthenticated and cross-origin requests',async()=>{
 const {NextRequest}=await import('next/server');const routes=await import('../../app/api/admin/hosting/route');const cron=await import('../../app/api/cron/hosting/route');
 const dir=mkdtempSync(join(tmpdir(),'lothuus-hosting-auth-')),previous=process.env.LOTHUUS_DATA_DIR,mode=process.env.BACKEND_MODE;process.env.LOTHUUS_DATA_DIR=dir;process.env.BACKEND_MODE='local';
 try{const get=await routes.GET(new NextRequest('http://localhost/api/admin/hosting'));assert.equal(get.status,401);const post=await routes.POST(new NextRequest('http://localhost/api/admin/hosting',{method:'POST',headers:{origin:'https://other.example'},body:'{}'}));assert.equal(post.status,403);const c=await cron.GET(new NextRequest('http://localhost/api/cron/hosting'));assert.equal(c.status,401);}finally{if(previous===undefined)delete process.env.LOTHUUS_DATA_DIR;else process.env.LOTHUUS_DATA_DIR=previous;if(mode===undefined)delete process.env.BACKEND_MODE;else process.env.BACKEND_MODE=mode;rmSync(dir,{recursive:true,force:true});}
});
test('an over-limit collection stays editable while new records roll back',async()=>{
 const {withStore}=await import('../backend/cloud');const {transact}=await import('../backend/repository');const dir=mkdtempSync(join(tmpdir(),'lothuus-hosting-limit-')),previous=process.env.LOTHUUS_DATA_DIR,mode=process.env.BACKEND_MODE;process.env.LOTHUUS_DATA_DIR=dir;process.env.BACKEND_MODE='local';
 try{transact(s=>{s.items=Array.from({length:195},(_,n)=>({id:String(n),title:'Bestaand object',photos:[],publication:'archived'} as unknown as typeof s.items[number]));});await withStore(s=>{s.items[0].title='Bijgewerkt';});assert.equal(transact(s=>s.items[0].title),'Bijgewerkt');await assert.rejects(withStore(s=>{s.items.push({...s.items[0],id:'nieuw'});}),/objectlimiet/);assert.equal(transact(s=>s.items.length),195);}finally{if(previous===undefined)delete process.env.LOTHUUS_DATA_DIR;else process.env.LOTHUUS_DATA_DIR=previous;if(mode===undefined)delete process.env.BACKEND_MODE;else process.env.BACKEND_MODE=mode;rmSync(dir,{recursive:true,force:true});}
});
