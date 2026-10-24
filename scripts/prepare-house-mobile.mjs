import sharp from 'sharp';
import { mkdir, readdir } from 'node:fs/promises';

// Ship small sources: resizing after decoding/upload would retain the startup peak.
let before=0,after=0;
for(const directory of ['public/house/materials','public/house/models/textures']){
  await mkdir(`${directory}/mobile`,{recursive:true});
  for(const name of await readdir(directory)){
    if(!/\.(webp|jpg)$/.test(name))continue;
    const source=sharp(`${directory}/${name}`),metadata=await source.metadata();
    await source.resize({width:512,height:512,fit:'inside',withoutEnlargement:true})
      .toFile(`${directory}/mobile/${name}`);
    const resized=await sharp(`${directory}/mobile/${name}`).metadata();
    before+=metadata.width*metadata.height*4;
    after+=resized.width*resized.height*4;
  }
}
console.log(`RGBA source texture storage: ${(before/1048576).toFixed(1)} → ${(after/1048576).toFixed(1)} MiB (excludes mipmaps, copies and driver overhead).`);
