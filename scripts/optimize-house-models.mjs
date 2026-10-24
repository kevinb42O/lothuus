import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Losslessly externalize embedded JPEGs. Identical image bytes get the same URL,
// so the high/low tree variants share downloads and the browser's image cache.
const directory=fileURLToPath(new URL('../public/house/models/',import.meta.url));
await mkdir(path.join(directory,'textures'),{recursive:true});
let removedBytes=0;
for(const name of (await readdir(directory)).filter(name=>name.endsWith('.glb'))){
  const source=await readFile(path.join(directory,name));
  if(source.readUInt32LE(0)!==0x46546c67||source.readUInt32LE(4)!==2)throw new Error(`Unsupported GLB: ${name}`);
  const jsonLength=source.readUInt32LE(12),document=JSON.parse(source.subarray(20,20+jsonLength).toString());
  if(!document.images?.some(image=>image.bufferView!==undefined))continue;
  if(document.buffers.length!==1||document.extensionsUsed?.some(extension=>extension!=='KHR_texture_transform'))throw new Error(`Review buffer extensions before optimizing ${name}`);
  const binaryOffset=20+jsonLength+8,binary=source.subarray(binaryOffset);
  const imageViews=new Set();
  for(const image of document.images){
    if(image.bufferView===undefined)continue;
    if(image.mimeType!=='image/jpeg')throw new Error(`Unsupported image: ${image.mimeType}`);
    const view=document.bufferViews[image.bufferView];
    const bytes=binary.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength);
    const hash=createHash('sha256').update(bytes).digest('hex');
    image.uri=`textures/${hash}.jpg`;await writeFile(path.join(directory,image.uri),bytes);
    imageViews.add(image.bufferView);delete image.bufferView;
  }
  const mapping=new Map(),views=[],chunks=[];let offset=0;
  document.bufferViews.forEach((view,index)=>{
    if(imageViews.has(index))return;
    const padding=(4-offset%4)%4;if(padding){chunks.push(Buffer.alloc(padding));offset+=padding;}
    mapping.set(index,views.length);
    chunks.push(binary.subarray(view.byteOffset??0,(view.byteOffset??0)+view.byteLength));
    views.push({...view,byteOffset:offset});offset+=view.byteLength;
  });
  const remap=holder=>{if(holder?.bufferView!==undefined){const index=mapping.get(holder.bufferView);if(index===undefined)throw new Error(`Accessor references an image in ${name}`);holder.bufferView=index;}};
  for(const accessor of document.accessors){remap(accessor);remap(accessor.sparse?.indices);remap(accessor.sparse?.values);}
  document.bufferViews=views;document.buffers[0].byteLength=offset;
  const json=Buffer.from(JSON.stringify(document));
  const paddedJSON=Buffer.alloc(Math.ceil(json.length/4)*4,0x20);json.copy(paddedJSON);
  const bin=Buffer.concat([...chunks,Buffer.alloc((4-offset%4)%4)]);
  const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+paddedJSON.length+bin.length,8);header.writeUInt32LE(paddedJSON.length,12);header.writeUInt32LE(0x4e4f534a,16);
  const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(bin.length);binHeader.writeUInt32LE(0x004e4942,4);
  const optimized=Buffer.concat([header,paddedJSON,binHeader,bin]);
  await writeFile(path.join(directory,name),optimized);removedBytes+=source.length-optimized.length;
  console.log(`${name}: ${source.length} → ${optimized.length} bytes (original JPEG bytes preserved)`);
}
console.log(`${removedBytes} embedded image bytes externalized; identical files share one texture URL.`);
