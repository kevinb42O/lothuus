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
