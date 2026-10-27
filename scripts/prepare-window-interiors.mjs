import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';

// Asset packaging only: strip the generation's panel seams, resize each crop,
// and extrude a two-pixel gutter to limit neighbouring-room bleed when mipmapped.
const source=process.argv[2];
if(!source)throw new Error('Pass the generated four-panel source image path.');
const meta=await sharp(source).metadata(),tile=64,height=128,gutter=2;
const panels=await Promise.all(Array.from({length:4},async(_,i)=>({
  input:await sharp(source).extract({left:Math.round(i*meta.width/4)+3,top:2,width:Math.floor(meta.width/4)-6,height:meta.height-4})
    .resize(tile-2*gutter,height-2*gutter,{fit:'cover'})
    .extend({top:gutter,bottom:gutter,left:gutter,right:gutter,extendWith:'copy'}).toBuffer(),
  left:i*tile,top:0,
})));
const buffer=await sharp({create:{width:tile*4,height,channels:3,background:'#383b3b'}}).composite(panels).webp({quality:84}).toBuffer();
for(const directory of ['public/house/materials','public/house/materials/mobile']){
  await mkdir(directory,{recursive:true});await writeFile(`${directory}/window-interiors.webp`,buffer);
}
console.log(JSON.stringify({width:tile*4,height,bytes:buffer.length,rgbaWithMipmapsBytes:174764}));
