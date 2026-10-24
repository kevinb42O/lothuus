/** Bake the accepted door once; visitors load the exact same triangles and textures. */
import * as T from 'three';
import { createHash } from 'node:crypto';
import { readFile,writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { buildFrontDoor } from '../src/components/house-door';
import { mergeSolids } from '../src/components/house-architecture';

async function bake(){
  const sources=['house-door.ts','house-door-tracing.ts','house-bell-tracing.ts'];
  const hash=createHash('sha256');
  for(const file of sources)hash.update(await readFile(new URL(`../src/components/${file}`,import.meta.url)));
  const stone=new T.MeshStandardMaterial(),lightStone=new T.MeshStandardMaterial();
  stone.name='Entrance limestone';lightStone.name='Entrance light limestone';
  const entrance=buildFrontDoor({glass:new T.MeshPhysicalMaterial(),stone,lightStone});
  const leaf=entrance.getObjectByName('Opening front door leaf') as T.Group;
  leaf.removeFromParent();mergeSolids(entrance);mergeSolids(leaf);entrance.add(leaf);
  entrance.userData.batched=true;entrance.userData.sourceDigest=hash.digest('hex');
  const json=JSON.stringify(entrance.toJSON());
  const compressed=gzipSync(json,{level:9});
  const output=new URL('../public/house/models/entrance.json.gz',import.meta.url);
  await writeFile(output,compressed);
  // Store typed data directly. The loader still receives the exact authored
  // ObjectLoader document, including texture pixels, material values and hinge.
  const blocks:Buffer[]=[];let offset=0;
  const types={Float32Array,Float64Array,Uint32Array,Uint16Array,Uint8Array,Int32Array,Int16Array,Int8Array};
  const manifest=JSON.stringify(JSON.parse(json),function(key,value){
    const ArrayType=types[this?.type as keyof typeof types];
    if((key==='array'||key==='data')&&Array.isArray(value)&&ArrayType){
      const typed=new ArrayType(value),bytes=Buffer.from(typed.buffer),start=offset;
      blocks.push(bytes);offset+=bytes.length;
      const padding=(8-offset%8)%8;if(padding){blocks.push(Buffer.alloc(padding));offset+=padding;}
      return {$houseArray:this.type,offset:start,length:value.length};
    }
    return value;
  });
  const header=Buffer.from(manifest),prefix=Buffer.alloc(Math.ceil((header.length+4)/8)*8);
  prefix.writeUInt32LE(header.length);header.copy(prefix,4);
  const binary=gzipSync(Buffer.concat([prefix,...blocks]),{level:9});
  await writeFile(new URL('../public/house/models/entrance.bin.gz',import.meta.url),binary);
  let triangles=0;entrance.traverse(object=>{if(object instanceof T.Mesh)triangles+=(object.geometry.index?.count??object.geometry.getAttribute('position').count)/3;});
  console.log(JSON.stringify({file:output.pathname,bytes:compressed.length,binaryBytes:binary.length,manifestBytes:header.length,triangles,sourceDigest:entrance.userData.sourceDigest}));
}
bake().catch(error=>{console.error(error);process.exitCode=1;});
