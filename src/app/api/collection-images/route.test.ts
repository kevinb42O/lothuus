import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { objects } from '../../../lib/collection';
import { initialStore, transact } from '../../../lib/backend/repository';
import type { Item } from '../../../lib/backend/types';
import { GET } from './[id]/route';

test('R2 source photos follow visibility and selection; private uploads and unknown IDs stay private', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lothuus-source-photo-'));
  const previous = { mode:process.env.BACKEND_MODE,data:process.env.LOTHUUS_DATA_DIR };
  process.env.BACKEND_MODE='local'; process.env.LOTHUUS_DATA_DIR=directory;
  try {
    const source=objects.find(o=>o.category==='inox-ijzer')!; assert(source, 'Nieuwe catalogus ontbreekt');
    const photo=source.photos![0], another=source.photos![1];
    await mkdir(join(directory,'images'));
    for (const p of [photo,another]) await writeFile(join(directory,'images',`${p.id}-detail.webp`),'source photo');
    const get=(id=photo.id,etag?:string,size='detail')=>GET(new NextRequest(`http://localhost/api/collection-images/${id}?size=${size}`,{headers:etag?{'If-None-Match':etag}:undefined}),{params:Promise.resolve({id})});
    const first=await get(); assert.equal(first.status,200); assert.equal(await first.text(),'source photo');
    assert.equal(first.headers.get('cache-control'),'private, no-cache');
    const tag=first.headers.get('etag')!; assert.equal((await get(photo.id,tag)).status,304);
    assert.equal((await get(randomUUID())).status,404); assert.equal((await get(photo.id,undefined,'original')).status,404);
    const item:Item={id:randomUUID(),sourceReference:source.id,title:'Privétekst',category:source.category,description:'',date:'',material:'',dimensions:'',maker:'',condition:'',priceCents:0,publication:'draft',photos:[photo,another],sourcePhotos:[photo,another],version:1,createdAt:''};
    transact(s=>{Object.assign(s,initialStore());s.items.push(item);});
    assert.equal((await get()).status,200);
    transact(s=>{s.items[0].publication='published';s.items[0].photos=[another];});
    assert.equal((await get(photo.id,tag)).status,404); assert.equal((await get(another.id)).status,200);
    transact(s=>{s.items[0].publication='archived';});
    assert.equal((await get(another.id)).status,404);
    const privatePhoto=randomUUID();await writeFile(join(directory,'images',`${privatePhoto}-detail.webp`),'private');
    assert.equal((await get(privatePhoto)).status,404);
  } finally {
    for (const [key,value] of Object.entries({BACKEND_MODE:previous.mode,LOTHUUS_DATA_DIR:previous.data})) if(value===undefined)delete process.env[key];else process.env[key]=value;
    await rm(directory,{recursive:true,force:true});
  }
});

test('direct source delivery checks visibility before issuing a signed link, including conditional requests', async () => {
  const keys = ['BACKEND_MODE','SUPABASE_URL','SUPABASE_SECRET_KEY','R2_DIRECT_DELIVERY','R2_ENDPOINT','R2_BUCKET','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY'];
  const previous = Object.fromEntries(keys.map(key => [key,process.env[key]]));
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, { BACKEND_MODE:'supabase', SUPABASE_URL:'https://isolated.example.test', SUPABASE_SECRET_KEY:'test', R2_DIRECT_DELIVERY:'true', R2_ENDPOINT:'https://abcdef.eu.r2.cloudflarestorage.com', R2_BUCKET:'private-media', R2_ACCESS_KEY_ID:'key', R2_SECRET_ACCESS_KEY:'secret' });
  const source = objects.find(o=>o.category==='inox-ijzer')!, photo=source.photos![0];
  const state=initialStore();
  globalThis.fetch=async()=>Response.json(state);
  const get=(tag?:string)=>GET(new NextRequest(`https://example.test/api/collection-images/${photo.id}?size=grid`, {headers:tag?{'If-None-Match':tag}:undefined}),{params:Promise.resolve({id:photo.id})});
  try {
    assert.equal((await get()).status,302);
    state.items.push({id:randomUUID(),sourceReference:source.id,title:'Private',category:source.category,description:'',date:'',material:'',dimensions:'',maker:'',condition:'',priceCents:0,publication:'archived',photos:[photo],sourcePhotos:[photo],version:1,createdAt:''});
    const hidden=await get(`"source-photo-v1-${photo.id}-grid"`);
    assert.equal(hidden.status,404); assert.equal(hidden.headers.get('location'),null);
    globalThis.fetch=async()=>Response.json({error:'unavailable'},{status:503});
    const unavailable=await get(); assert.equal(unavailable.status,503); assert.equal(unavailable.headers.get('location'),null);
  } finally {
    globalThis.fetch=originalFetch;
    for (const [key,value] of Object.entries(previous)) if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
});

test('warm photo bytes never bypass unpublishing, selection changes, or a failed access check', async t => {
  const { S3Client } = await import('@aws-sdk/client-s3');
  const keys = ['BACKEND_MODE','SUPABASE_URL','SUPABASE_SECRET_KEY','R2_DIRECT_DELIVERY','R2_ENDPOINT','R2_BUCKET','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, { BACKEND_MODE:'supabase', SUPABASE_URL:'https://isolated.example.test', SUPABASE_SECRET_KEY:'test', R2_DIRECT_DELIVERY:'false', R2_ENDPOINT:'https://abcdef.eu.r2.cloudflarestorage.com', R2_BUCKET:'byte-cache-route-test', R2_ACCESS_KEY_ID:'key', R2_SECRET_ACCESS_KEY:'secret' });
  const source = objects.find(o => o.category === 'inox-ijzer')!, photo = source.photos![0], other = source.photos![1];
  const state = initialStore(); let reads = 0, accessChecks = 0;
  globalThis.fetch = async () => { accessChecks++; return Response.json(state); };
  t.mock.method(S3Client.prototype, 'send', async () => { reads++; return { Body: { transformToByteArray: async () => new TextEncoder().encode('same photo bytes') } }; });
  const get = (tag?: string) => GET(new NextRequest(`https://example.test/api/collection-images/${photo.id}?size=grid`, { headers: tag ? { 'If-None-Match': tag } : undefined }), { params: Promise.resolve({ id: photo.id }) });
  try {
    const first = await get(); assert.equal(first.status, 200); assert.equal(await first.text(), 'same photo bytes');
    const tag = first.headers.get('etag')!;
    const warm = await get(); assert.equal(warm.status, 200); assert.equal(await warm.text(), 'same photo bytes');
    assert.equal(warm.headers.get('cache-control'), 'private, no-cache'); assert.equal(reads, 1);
    state.items.push({id:randomUUID(),sourceReference:source.id,title:'Private',category:source.category,description:'',date:'',material:'',dimensions:'',maker:'',condition:'',priceCents:0,publication:'published',photos:[other],sourcePhotos:[photo,other],version:1,createdAt:''});
    assert.equal((await get()).status, 404); assert.equal((await get(tag)).status, 404);
    state.items[0].publication = 'archived';
    assert.equal((await get()).status, 404);
    globalThis.fetch = async () => { accessChecks++; return Response.json({ error:'unavailable' }, { status:503 }); };
    assert.equal((await get()).status, 503);
    assert.equal(reads, 1, 'denied requests never reach even the warm byte cache');
    assert.equal(accessChecks, 6, 'every request still checks current visibility');
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key,value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
