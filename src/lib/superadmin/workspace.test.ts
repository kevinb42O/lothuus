import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initialStore} from '../backend/repository';
import type {Item} from '../backend/types';
import {restoreProduct,csvCell,boundedCsv,workspaceCommand} from './workspace';
import {activityInput} from './queries';
function product():Item{return {id:randomUUID(),version:3,title:'Huidige titel',description:'Huidige tekst',category:'objecten',priceCents:5000,publication:'draft',date:'1970',dimensions:'20 cm',condition:'Goed',maker:'',material:'',photos:[{id:randomUUID(),alt:'Foto'}],createdAt:new Date().toISOString(),productNumber:'K10',materialGroup:'K'};}
test('field restoration preserves immutable identity, photos, new content and sale history',()=>{
 const state=initialStore(),current=product();state.items=[current];
 const snapshot={...current,version:1,title:'Vroegere titel',description:'Vroegere tekst',photos:[],productNumber:'K1'};
 restoreProduct(state,{itemId:current.id,expectedVersion:3,fields:['title']},snapshot);
 assert.equal(state.items[0].title,'Vroegere titel');assert.equal(state.items[0].description,'Huidige tekst');assert.deepEqual(state.items[0].photos,current.photos);assert.equal(state.items[0].productNumber,'K10');assert.equal(state.items[0].version,4);
 assert.throws(()=>restoreProduct(state,{itemId:current.id,expectedVersion:3,fields:['title']},snapshot),/intussen gewijzigd/);
 assert.throws(()=>restoreProduct(state,{itemId:current.id,expectedVersion:4,fields:['photos']},snapshot),/gekozen herstel/);
 assert.throws(()=>restoreProduct(state,{itemId:current.id,expectedVersion:4,fields:['title']},{...snapshot,id:randomUUID()}),/gekozen herstel/);
});
test('CSV quotes content and prevents spreadsheet formula execution including leading whitespace',()=>{
 for(const value of ['=CMD()',' +SUM(1)','@formula','-1','\ttext'])assert.ok(csvCell(value).startsWith('"\''));
 assert.equal(csvCell('Een "vaas"'),'"Een ""vaas"""');assert.equal(csvCell('Normale tekst'),'"Normale tekst"');
});
test('workspace validation rejects impersonation, forbidden restore fields and malformed filters',()=>{
 const restore={action:'restore',itemId:randomUUID(),versionId:'12',expectedVersion:3,fields:['title'],reason:'Correctie'};
 assert.equal(workspaceCommand.safeParse(restore).success,true);
 for(const fields of [['id'],['photos'],['productNumber'],['version'],[]])assert.equal(workspaceCommand.safeParse({...restore,fields}).success,false);
 assert.equal(workspaceCommand.safeParse({...restore,actor:randomUUID()}).success,false);
 assert.throws(()=>activityInput(new URLSearchParams({who:'administrator'})),/filters/);
 assert.throws(()=>activityInput(new URLSearchParams({since:'2026-11-05',until:'2026-11-04'})),/begin/);
 assert.throws(()=>activityInput(new URLSearchParams({before:'1 OR 1=1'})),/filters/);
});

test('restoration never changes an agreed price on a reserved or sold product',()=>{
 const state=initialStore(),current=product();state.items=[current];
 state.reservations=[{itemId:current.id,status:'completed',payments:[],priceCents:current.priceCents}] as unknown as typeof state.reservations;
 assert.throws(()=>restoreProduct(state,{itemId:current.id,expectedVersion:3,fields:['priceCents']},{...current,priceCents:2500}),/prijs tijdens/);
 assert.equal(state.items[0].priceCents,5000);
 restoreProduct(state,{itemId:current.id,expectedVersion:3,fields:['description']},{...current,description:'Herstelde omschrijving'});
 assert.equal(state.items[0].description,'Herstelde omschrijving');assert.equal(state.reservations[0].status,'completed');
});

test('large CSV downloads stop on row boundaries and expose the actual exported row count',()=>{
 const rows=[['Titel'],['é'.repeat(15)],['Nog een rij'],['Laatste']];
 const result=boundedCsv(rows,50);
 assert.equal(result.count,1);assert.ok(Buffer.byteLength(result.content)<=50);assert.match(result.content,/é/);assert.equal(result.content.includes('Nog een rij'),false);
});
