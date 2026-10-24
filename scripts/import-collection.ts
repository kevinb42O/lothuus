/** Run with node --env-file=.env.local --import tsx scripts/import-collection.ts --apply.
 * Resumes from a private manifest; existing products and numbering are never replaced.
 */
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {savePhoto} from '../src/lib/backend/media';
import {serverDatabase,withStore} from '../src/lib/backend/cloud';
import {command} from '../src/lib/backend/service';
import records from '../src/lib/collection.json';
async function main() {
const apply=process.argv.includes('--apply');
const path=resolve('.data/cloud-import.json');
type Entry={id:string;alt:string};
const manifest:{photos:Record<string,Entry>;products:Record<string,string>} = existsSync(path)?JSON.parse(await readFile(path,'utf8')):{photos:{},products:{}};
const allPhotos=records.flatMap(r=>r.photos.map(p=>({src:p.src,alt:p.alt})));
console.log({apply,products:records.length,photos:allPhotos.length,alreadyUploaded:Object.keys(manifest.photos).length,groupsWithMoreThanEight:records.filter(r=>r.photos.length>8).map(r=>({source:r.id,count:r.photos.length}))});
if(!apply) process.exit(0);
await mkdir(resolve('.data'),{recursive:true,mode:0o700});
let pending=Promise.resolve();
const persist=()=>pending=pending.then(()=>writeFile(path,JSON.stringify(manifest,null,2),{mode:0o600}));
const loaded=await serverDatabase().rpc('lothuus_load_state');if(loaded.error)throw new Error(loaded.error.message);

let count=Object.keys(manifest.photos).length;
let cursor=0;
async function uploadNext() {
while(cursor<allPhotos.length) {
 const photo=allPhotos[cursor++];
 if(manifest.photos[photo.src])continue;
 const bytes=await readFile(resolve('public'+photo.src));
 let saved:Entry|undefined;
 for(let attempt=0;attempt<6;attempt++) {
  try {saved=await savePhoto(new File([new Uint8Array(bytes)],photo.src.split('/').at(-1)!,{type:'image/webp'}));break;}
  catch(e){if(attempt===5)throw e;console.log({retry:attempt+1,source:photo.src});await new Promise(r=>setTimeout(r,Math.min(60000,5000*2**attempt)));}
 }
 manifest.photos[photo.src]={...saved!,alt:photo.alt};await persist();count++;
 if(count%25===0)console.log({uploaded:count,total:allPhotos.length});
}
}
// Four bounded workers; the manifest writer is serialized.
await Promise.all(Array.from({length:4},()=>uploadNext()));
for(const record of [...records].sort((a,b)=>a.id.localeCompare(b.id))) {
 const key=createHash('sha256').update('lothuus-source:'+record.id).digest('hex').slice(0,32);const creationKey=`${key.slice(0,8)}-${key.slice(8,12)}-4${key.slice(13,16)}-a${key.slice(17,20)}-${key.slice(20)}`;
 const item=await withStore(s=>{
  const previous=s.items.find(i=>i.creationKey===creationKey);if(previous){previous.sourcePhotos=record.photos.map(p=>manifest.photos[p.src]);return previous;}
  command(s,{action:'save-item',item:{creationKey,materialGroup:record.id[0],title:record.title,category:record.category,description:'',priceCents:0,priceUnset:true,date:'',material:record.material,dimensions:'',maker:'',condition:'',publication:'draft',editorReady:false,photos:record.photos.slice(0,8).map(p=>manifest.photos[p.src])}});
  const created=s.items.find(i=>i.creationKey===creationKey)!;created.sourceReference=record.id;created.sourcePhotoCount=record.photos.length;created.sourcePhotos=record.photos.map(p=>manifest.photos[p.src]);return created;
 });
 manifest.products[record.id]=item.id;await persist();
}
const {developmentR2}=await import('../src/lib/backend/r2-development');
const mediaBucket=process.env.R2_BUCKET;process.env.R2_BUCKET='lothuus-backups';
try {await developmentR2('imports/collection-2026-10-24.json','PUT',new TextEncoder().encode(JSON.stringify(manifest)));}finally{process.env.R2_BUCKET=mediaBucket;}
console.log({complete:true,products:Object.keys(manifest.products).length,photos:Object.keys(manifest.photos).length});

}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
