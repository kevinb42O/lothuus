import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import * as T from 'three';
import {decodeHouseEntrance} from './house-entrance-binary';

test('binary entrance retains every geometry attribute, texture pixel and ObjectLoader property',async()=>{
  const json=JSON.parse(gunzipSync(await readFile(new URL('../../public/house/models/entrance.json.gz',import.meta.url))).toString());
  const bytes=gunzipSync(await readFile(new URL('../../public/house/models/entrance.bin.gz',import.meta.url)));
  const binary=decodeHouseEntrance(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  const normalized=JSON.parse(JSON.stringify(binary,(_key,value)=>ArrayBuffer.isView(value)?Array.from(value as unknown as number[]):value));
  assert.deepEqual(normalized,json);
  const entrance=new T.ObjectLoader().parse(binary);
  assert.equal(entrance.userData.sourceDigest,json.object.userData.sourceDigest);
  assert.ok(entrance.getObjectByName('Opening front door leaf'));
});

test('the shipped entrance contains the current refined ironwork and retains its moving hinge',async()=>{
  const hash=createHash('sha256');
  for(const file of ['house-door.ts','house-door-tracing.ts','house-bell-tracing.ts'])hash.update(await readFile(new URL(file,import.meta.url)));
  const packed=await readFile(new URL('../../public/house/models/entrance.json.gz',import.meta.url));
  const entrance=new T.ObjectLoader().parse(JSON.parse(gunzipSync(packed).toString())) as T.Group;
  assert.equal(entrance.userData.sourceDigest,hash.digest('hex'),'Regenerate with npx tsx scripts/bake-house-entrance.ts after editing the accepted door');
  const leaf=entrance.getObjectByName('Opening front door leaf') as T.Group;
  assert.ok(leaf);assert.equal(entrance.userData.batched,true);
  entrance.updateMatrixWorld(true);const closed=new T.Box3().setFromObject(leaf);
  leaf.rotation.y=Math.PI*.54;entrance.updateMatrixWorld(true);
  const open=new T.Box3().setFromObject(leaf);
  assert.ok(open.min.z<closed.min.z-.9);assert.ok(open.max.x<0,'The complete leaf clears the centered camera path');
  let movingTriangles=0;leaf.traverse(object=>{if(object instanceof T.Mesh)movingTriangles+=(object.geometry.index?.count??0)/3;});
  assert.ok(movingTriangles>10000,'The detailed leaf must be retained, not replaced by a flat slab');
});
