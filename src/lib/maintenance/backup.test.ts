import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { backupTables, type CloudBackup } from './backup-format';
import { dailyCloudBackup } from './backup';
import { initialStore } from '../backend/repository';

test('cloud backup verifies storage before promotion and prunes only dated backup objects', async () => {
  const names = ['BACKEND_MODE','SUPABASE_URL','SUPABASE_SECRET_KEY','R2_ENDPOINT','R2_BUCKET','R2_BACKUP_BUCKET','R2_BACKUP_ACCESS_KEY_ID','R2_BACKUP_SECRET_ACCESS_KEY'];
  const previous = Object.fromEntries(names.map(k=>[k,process.env[k]])), originalFetch = globalThis.fetch;
  const objects = new Map<string,Buffer>(), deleted: string[] = [], completed: boolean[] = [];
  const snapshot = {schemaVersion:2,createdAt:new Date().toISOString(),tables:Object.fromEntries(backupTables.map(t=>[t,[]]))} as unknown as CloudBackup;
  snapshot.tables.store=[{id:true,revision:1,body:initialStore()}];snapshot.tables.hosting_account=[{id:true,plan:'basis'}];snapshot.tables.heart_settings=[{id:true,enabled:true}];snapshot.tables.analytics_config=[{id:true,enabled:true}];
  let corrupt = false;
  const server = createServer(async (request,response)=>{
    const url = new URL(request.url!,'http://localhost'), key = decodeURIComponent(url.pathname.replace('/lothuus-backups/',''));
    const chunks:Buffer[]=[];for await(const chunk of request)chunks.push(Buffer.from(chunk));
    if(request.method==='PUT'){objects.set(key,Buffer.concat(chunks));response.writeHead(200);response.end();return;}
    if(request.method==='GET'&&url.searchParams.has('list-type')){response.writeHead(200,{'Content-Type':'application/xml'});response.end('<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>database/2020-01-01T00-00-00Z.json</Key><LastModified>2020-01-01T00:00:00Z</LastModified></Contents><Contents><Key>database/latest.json</Key><LastModified>2020-01-01T00:00:00Z</LastModified></Contents><Contents><Key>originals/private-photo</Key><LastModified>2020-01-01T00:00:00Z</LastModified></Contents></ListBucketResult>');return;}
    if(request.method==='POST'&&url.searchParams.has('delete')){deleted.push(Buffer.concat(chunks).toString());response.writeHead(200,{'Content-Type':'application/xml'});response.end('<DeleteResult/>');return;}
    if(request.method==='GET'&&objects.has(key)){response.writeHead(200);response.end(corrupt?Buffer.from('corrupt'):objects.get(key));return;}
    response.writeHead(404);response.end();
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  Object.assign(process.env,{BACKEND_MODE:'supabase',SUPABASE_URL:'https://backup-test.example.test',SUPABASE_SECRET_KEY:'isolated-key',R2_ENDPOINT:`http://127.0.0.1:${(server.address() as AddressInfo).port}`,R2_BUCKET:'lothuus-media',R2_BACKUP_BUCKET:'lothuus-backups',R2_BACKUP_ACCESS_KEY_ID:'test-access',R2_BACKUP_SECRET_ACCESS_KEY:'test-secret'});
  globalThis.fetch=async(input,init)=>{
    const rpc=String(input).split('/').at(-1);
    if(rpc==='lothuus_maintenance_claim')return Response.json(true);
    if(rpc==='lothuus_backup_state')return Response.json(snapshot);
    assert.equal(rpc,'lothuus_maintenance_finish');completed.push(JSON.parse(String(init?.body)).succeeded);return Response.json(null);
  };
  try{
    assert.equal((await dailyCloudBackup()).completed,true);assert.deepEqual(completed,[true]);
    assert.ok(objects.has('database/latest.json'));assert.equal(deleted.length,1);assert.match(deleted[0],/2020-01-01/);assert.doesNotMatch(deleted[0],/latest|private-photo/);
    const pointer=objects.get('database/latest.json')!;corrupt=true;
    await assert.rejects(dailyCloudBackup(),/checksum mismatch/);assert.deepEqual(completed,[true,false]);assert.deepEqual(objects.get('database/latest.json'),pointer);
  }finally{
    globalThis.fetch=originalFetch;for(const name of names)if(previous[name]===undefined)delete process.env[name];else process.env[name]=previous[name];
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
});
