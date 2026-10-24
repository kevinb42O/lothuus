/** Downloads the latest private backup and proves database restoration in a new local directory. */
import {mkdir,mkdtemp,writeFile,chmod} from 'node:fs/promises';
import {resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {developmentR2} from '../src/lib/backend/r2-development';
import type {Item,Store} from '../src/lib/backend/types';
async function main() {
 process.env.R2_BUCKET='lothuus-backups';
 const pointer=await developmentR2('database/latest.json','GET');assert(pointer,'Latest backup pointer missing');
 const latest=await pointer.json() as {key:string;sha256:string};assert(/^database\/[^/]+\.json$/.test(latest.key));
 const response=await developmentR2(latest.key,'GET');assert(response,'Backup missing');const bytes=new Uint8Array(await response.arrayBuffer());
 const digest=createHash('sha256').update(bytes).digest('hex');assert.equal(digest,latest.sha256,'Backup checksum mismatch');
 const backup=JSON.parse(new TextDecoder().decode(bytes)) as {schemaVersion:number;store:{revision:number;state:Store};media:{id:string}[];productNumbers:{number:string;item_id:string}[]};
 assert.equal(backup.schemaVersion,1);assert.equal(backup.store.state.schemaVersion,1);
 const state=backup.store.state,media=new Set(backup.media.map(m=>m.id));
 assert.equal(new Set(state.items.map(i=>i.id)).size,state.items.length,'Duplicate item IDs');
 const numbers=new Map(backup.productNumbers.map(n=>[n.number,n.item_id]));
 for(const item of state.items) {
  for(const photo of [...item.photos,...(item.sourcePhotos || [])])assert(media.has(photo.id),`Missing media for ${item.productNumber}`);
  for(const number of [item.productNumber,...(item.previousNumbers || [])].filter(Boolean) as string[])assert.equal(numbers.get(number),item.id,'Number registry mismatch');
 }
 await mkdir(resolve('.backups'),{recursive:true,mode:0o700});const dir=await mkdtemp(resolve('.backups/restore-test-'));
 await writeFile(resolve(dir,'snapshot.json'),bytes,{mode:0o600});
 const db=new DatabaseSync(resolve(dir,'lothuus.sqlite'));
 try {db.exec('CREATE TABLE app_state (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL)');db.prepare('INSERT INTO app_state(id,body) VALUES(1,?)').run(JSON.stringify(state));const restored=JSON.parse((db.prepare('SELECT body FROM app_state WHERE id=1').get() as {body:string}).body);assert.deepEqual(restored,state);}finally{db.close();}
 await chmod(resolve(dir,'lothuus.sqlite'),0o600);
 await writeFile(resolve(dir,'verification.json'),JSON.stringify({sha256:digest,source:latest.key,revision:backup.store.revision,items:state.items.length,media:media.size,verifiedAt:new Date().toISOString()},null,2),{mode:0o600});
 console.log({restored:true,checksumVerified:true,items:state.items.length,sourcePhotos:state.items.reduce((n,i:Item)=>n+(i.sourcePhotos?.length || 0),0),media:media.size,numberRegistryVerified:true,directory:dir});
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
