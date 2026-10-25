import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialHearts, writeHearts, cleanHearts, orderHearts } from './local';
import { buildHeartReport } from './report';
import { initialStore } from '../backend/repository';
import { heartDay, shiftDay } from './types';
const object = { id: 'K001', title: 'Vaas', reference: 'K001', image: '/collection/K001/K001-01.webp', category: 'keramiek', source: 'collection' as const };
test('baseline, retries, late requests and real toggles have distinct semantics',()=>{
 const s=initialHearts(); const write=(sequence:number,selected:boolean,baseline=false)=>writeHearts(s,'browser',[{id:object.id,object,sequence,selected,baseline}]);
 write(1,true,true);assert.equal(s.days.length,0);
 write(2,false);write(3,true);write(3,true);write(1,false);
 assert.equal(s.days[0].added,1);assert.equal(s.days[0].removed,1);assert.equal(s.browsers.browser.states.K001.selected,true);
 write(4,false,true);assert.equal(s.days[0].removed,1);
});
test('browser retention expires without manufacturing lost interest',()=>{
 const s=initialHearts(),old=Date.now()-91*86400000;
 writeHearts(s,'old',[{id:object.id,object,sequence:1,selected:true}],old);
 cleanHearts(s);assert.equal(Object.keys(s.browsers).length,0);assert.equal(s.days[0].added,1);assert.equal(s.days[0].removed,0);
});
test('Belgian calendar dates handle DST and midnight independently from UTC',()=>{
 assert.equal(heartDay('2026-10-24T22:30:00Z'),'2026-10-25');
 assert.equal(heartDay('2026-10-25T23:30:00Z'),'2026-10-26');
 assert.equal(shiftDay('2026-03-29',-1),'2026-03-28');
});
test('report filters totals, paginates, preserves baseline objects and compares complete windows',()=>{
 const s=initialHearts();s.startedAt='2026-01-01T00:00:00Z';s.objects=[object,{...object,id:'G001',category:'glas',title:'Glas'}];
 s.days=[{day:'2026-10-24',id:'K001',added:4,removed:1,ordered:1},{day:'2026-10-25',id:'K001',added:2,removed:0,ordered:0},{day:'2026-10-18',id:'K001',added:3,removed:0,ordered:0}];
 const report=buildHeartReport(s,initialStore(),new URLSearchParams('period=7&category=keramiek'),Date.parse('2026-10-25T12:00:00Z'));
 assert.equal(report.totals.added,6);assert.equal(report.totals.removed,1);assert.equal(report.comparable,true);assert.equal(report.previousAdded,3);assert.equal(report.totalRows,1);assert.equal(report.rows[0].ordered,1);
 const empty=buildHeartReport(s,initialStore(),new URLSearchParams('q=onbestaand'),Date.parse('2026-10-25T12:00:00Z'));assert.equal(empty.totals.added,0);assert.equal(empty.rows.length,0);
});
test('owner heart endpoints reject unauthenticated requests and public writes require origin',async()=>{
 const {NextRequest}=await import('next/server');
 const {GET,POST}=await import('../../app/api/admin/hearts/route');
 const {POST:publicPost}=await import('../../app/api/hearts/route');
 const old=process.env.BACKEND_MODE;process.env.BACKEND_MODE='local';
 try{
  assert.equal((await GET(new NextRequest('http://localhost/api/admin/hearts'))).status,401);
  assert.equal((await POST(new NextRequest('http://localhost/api/admin/hearts',{method:'POST',headers:{origin:'http://localhost'},body:JSON.stringify({enabled:false})}))).status,401);
  assert.equal((await publicPost(new NextRequest('http://localhost/api/hearts',{method:'POST',body:'{}'}))).status,403);
 }finally{if(old===undefined)delete process.env.BACKEND_MODE;else process.env.BACKEND_MODE=old;}
});

test('a new measurement never invents zero observations before its start',()=>{
 const s=initialHearts();s.startedAt='2026-10-25T02:35:00Z';
 const report=buildHeartReport(s,initialStore(),new URLSearchParams('period=30'),Date.parse('2026-10-25T12:00:00Z'));
 assert.equal(report.from,'2026-10-25');assert.equal(report.series.length,1);assert.equal(report.comparable,false);
});

test('retired object removals reuse the snapshot; unknown objects cannot inject one',()=>{
 const s=initialHearts();writeHearts(s,'browser',[{id:object.id,object,sequence:1,selected:true}]);
 writeHearts(s,'browser',[{id:object.id,object:null,sequence:2,selected:false},{id:'fake',object:null,sequence:3,selected:true}]);
 assert.equal(s.days[0].removed,1);assert.equal(s.browsers.browser.states.K001.selected,false);assert.equal(s.objects.length,1);assert.equal(s.browsers.browser.states.fake,undefined);
});
test('object detail ignores the list filters, including in its graph and totals',()=>{
 const s=initialHearts();s.startedAt='2026-01-01T00:00:00Z';s.objects=[object];s.days=[{day:'2026-10-25',id:'K001',added:4,removed:1,ordered:0}];
 const r=buildHeartReport(s,initialStore(),new URLSearchParams('period=7&object=K001&category=glas&q=elsewhere'),Date.parse('2026-10-25T12:00:00Z'));
 assert.equal(r.detail?.added,4);assert.equal(r.totals.added,4);assert.equal(r.totals.removed,1);
});
test('retention uses 24 calendar months, including a leap-day boundary',async()=>{
 const {monthsBefore}=await import('./types');assert.equal(monthsBefore('2028-02-29',24),'2026-02-28');assert.equal(monthsBefore('2026-10-25',24),'2024-10-25');
 const s=initialHearts();s.days=[{id:'K001',day:'2026-02-28',added:1,removed:0,ordered:0}];cleanHearts(s,Date.parse('2028-02-29T12:00:00Z'));assert.equal(s.days.length,1);
});

test('checkout before an in-flight add cannot revive a selection, and retry cannot clear a newer add',()=>{
 const s=initialHearts();orderHearts(s,'browser',[object],100);
 writeHearts(s,'browser',[{id:object.id,object,sequence:99,selected:true}]);assert.equal(s.browsers.browser.states.K001.selected,false);assert.equal(s.days.length,0);
 writeHearts(s,'browser',[{id:object.id,object,sequence:101,selected:true}]);orderHearts(s,'browser',[object],100);
 assert.equal(s.browsers.browser.states.K001.selected,true);assert.equal(s.days[0].added,1);assert.equal(s.days[0].ordered,0);
});

test('published import status follows both inventory and original collection reservations',()=>{
 const s=initialStore();
 s.items=[{id:'11111111-1111-4111-8111-111111111111',sourceReference:'K001',title:'Gepubliceerde vaas',category:'keramiek',description:'',priceCents:1200,date:'',material:'',dimensions:'',maker:'',condition:'',publication:'published',photos:[],version:1,createdAt:'2026-01-01T12:00:00Z'}];
 s.reservations=[{id:'r',itemId:'K001',status:'active',source:'web',createdAt:'2026-10-25T10:00:00Z'} as typeof s.reservations[number]];
 const raw=initialHearts();raw.startedAt='2026-01-01T00:00:00Z';raw.objects=[object];
 const r=buildHeartReport(raw,s,new URLSearchParams(),Date.parse('2026-10-25T12:00:00Z'));assert.equal(r.rows[0].availability,'reserved');assert.equal(r.rows[0].reservations,1);
 s.items[0].sourceReference=undefined;s.items[0].publication='draft';raw.objects=[{...object,id:s.items[0].id,source:'inventory'}];
 const draft=buildHeartReport(raw,s,new URLSearchParams(),Date.parse('2026-10-25T12:00:00Z'));assert.equal(draft.rows[0].availability,'missing');
});
test('all-time reports keep the first retained date across a leap year',()=>{
 const raw=initialHearts();raw.startedAt='2024-01-01T12:00:00Z';raw.objects=[object];raw.days=[{id:'K001',day:'2024-10-25',added:1,removed:0,ordered:0}];
 const r=buildHeartReport(raw,initialStore(),new URLSearchParams('period=all'),Date.parse('2026-10-25T12:00:00Z'));assert.equal(r.from,'2024-10-25');assert.equal(r.totals.added,1);
});
