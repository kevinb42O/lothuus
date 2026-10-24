import { randomUUID } from 'node:crypto';
import { cloudMode, serverDatabase } from './cloud';
import { BusinessError } from './service';
async function putObject(key:string,body:Uint8Array) {
  if (process.env.NODE_ENV !== 'production' && process.env.R2_USE_WRANGLER === 'true') { const {developmentR2}=await import('./r2-development'); return developmentR2(key,'PUT',body); }
  const { S3Client,PutObjectCommand }=await import('@aws-sdk/client-s3');
  if(!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET || !process.env.R2_ENDPOINT) throw new BusinessError('De foto-opslag is nog niet beschikbaar.',503);
  const s3=new S3Client({region:'auto',endpoint:process.env.R2_ENDPOINT,credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY}});
  return s3.send(new PutObjectCommand({Bucket:process.env.R2_BUCKET,Key:key,Body:body,ContentType:key.endsWith('.webp')?'image/webp':'application/octet-stream'}));
}
export async function savePhoto(file:File) {
  if(file.size===0 || file.size>15000000) throw new BusinessError('Kies een foto van maximaal 15 MB.');
  const bytes=new Uint8Array(await file.arrayBuffer()), id=randomUUID(), original=`originals/${id}`;
  let width:number,height:number;
  const variants: [string,Uint8Array][]=[];
  {
    const {default:sharp}=await import('sharp');
    const image=sharp(bytes,{limitInputPixels:40000000}), info=await image.metadata();
    if(!info.format || !['jpeg','png','webp','heif','avif'].includes(info.format) || (info.pages || 1)>1) throw new BusinessError('Kies een stilstaande JPEG-, PNG-, WebP- of AVIF-foto.');
    width=info.width!;height=info.height!;
    for(const [size,target] of [['thumb',320],['grid',800],['detail',1600]] as const) variants.push([size,await image.clone().rotate().resize({width:target,withoutEnlargement:true}).webp({quality:82}).toBuffer()]);
  }
  if(cloudMode()) {
    await putObject(original,bytes);
    for(const [size,body] of variants) await putObject(`variants/${id}-${size}.webp`,body);
    const registered=await serverDatabase().rpc('lothuus_register_media',{media_id:id,original_key:original,width,height,bytes:file.size});
    if(registered.error) throw new BusinessError('De foto kon niet volledig worden opgeslagen. Probeer opnieuw.',503);
  } else {
    if(process.env.NODE_ENV==='production') throw new BusinessError('Online foto-opslag ontbreekt.',503);
    const {mkdir,writeFile}=await import('node:fs/promises'),{join}=await import('node:path'),{dataDirectory}=await import('./repository');
    const dir=join(dataDirectory(),'images');await mkdir(dir,{recursive:true,mode:0o700});
    for(const [size,body] of variants) await writeFile(join(dir,`${id}-${size}.webp`),body,{mode:0o600});
  }
  return {id,alt:file.name.replace(/\.[^.]+$/,'').slice(0,240)||'Productfoto'};
}
export async function readPhoto(id:string,size:string):Promise<BodyInit|null> {
  if(cloudMode()) {
    if(process.env.NODE_ENV!=='production' && process.env.R2_USE_WRANGLER==='true') { const {developmentR2}=await import('./r2-development'); return (await developmentR2(`variants/${id}-${size}.webp`,'GET'))?.body || null; }
    const {S3Client,GetObjectCommand}=await import('@aws-sdk/client-s3');
    if(!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) throw new BusinessError('Foto-opslag niet beschikbaar.',503);
    const s3=new S3Client({region:'auto',endpoint:process.env.R2_ENDPOINT,credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY}});
    const object=await s3.send(new GetObjectCommand({Bucket:process.env.R2_BUCKET,Key:`variants/${id}-${size}.webp`}));
    return object.Body?new Uint8Array(await object.Body.transformToByteArray()):null;
  }
  const {readFile}=await import('node:fs/promises'),{join}=await import('node:path'),{dataDirectory}=await import('./repository');
  return new Uint8Array(await readFile(join(dataDirectory(),'images',`${id}-${size}.webp`)));
}
