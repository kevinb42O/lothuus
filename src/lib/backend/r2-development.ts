/** Local development only. Uses the existing Wrangler grant; never creates or saves an R2 credential. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run=promisify(execFile);
let pendingAuthorization: Promise<void> | undefined;
let authorization:{token:string;until:number}|undefined;
export async function developmentR2(key:string,method:'GET'|'PUT',body?:Uint8Array) {
 if(process.env.NODE_ENV==='production') throw new Error('Development transport disabled');
 if(!authorization || authorization.until<Date.now()) {
  pendingAuthorization ||= (async()=>{
  const {stdout}=await run(process.platform==='win32'?'node_modules/.bin/wrangler.cmd':'node_modules/.bin/wrangler',['auth','token','--json'],{timeout:20000,maxBuffer:100000});
  const result=JSON.parse(stdout);if(result.type!=='oauth' || !result.token) throw new Error('Wrangler login required');
  authorization={token:result.token,until:Date.now()+5*60000};
  })().finally(()=>{pendingAuthorization=undefined;});
  await pendingAuthorization;
 }
 const account=process.env.CLOUDFLARE_ACCOUNT_ID,bucket=process.env.R2_BUCKET;
 if(!account || !bucket) throw new Error('R2 development configuration missing');
 const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/${bucket}/objects/${key.split('/').map(encodeURIComponent).join('/')}`,{method,headers:{Authorization:`Bearer ${authorization!.token}`,'cf-r2-jurisdiction':'eu','Content-Type':key.endsWith('.webp')?'image/webp':'application/octet-stream'},body:body as BodyInit|undefined,signal:AbortSignal.timeout(30000),cache:'no-store'});
 if(response.status===404) return null;
 if(!response.ok) throw new Error(`R2 request failed (${response.status})`);
 return response;
}
