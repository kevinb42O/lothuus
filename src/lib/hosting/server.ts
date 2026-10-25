import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { cloudMode, serverDatabase } from '../backend/cloud';
import { BusinessError } from '../backend/service';
import { PRODUCTS, paymentPayload, type HostingProduct, type HostingReport } from './catalogue';
export async function hostingRpc(name: string, args?: Record<string, unknown>) {
  const { data, error } = await serverDatabase().rpc(name, args);
  if (error) { console.error('[hosting]', name, error.code); throw new BusinessError('De hostinggegevens zijn tijdelijk niet bereikbaar. Probeer opnieuw.', 503); }
  return data;
}
export async function hostingReport(): Promise<HostingReport> {
  if (cloudMode()) {
    const report = await hostingRpc('lothuus_hosting_report');
    if (!report || !['basis','pro','premium'].includes(report.plan)) throw new BusinessError('Je pakketgegevens zijn tijdelijk niet beschikbaar.',503);
    // An earlier month is never presented as this month’s usage.
    if (report.metrics.direct.periodStart && report.metrics.direct.periodStart.slice(0,7) !== new Date().toISOString().slice(0,7)) report.metrics.direct = { value: null, measuredAt: null, status: 'unavailable' };
    return report;
  }
  if (process.env.NODE_ENV === 'production') throw new BusinessError('Online opslag ontbreekt.',503);
  return (await import('./local')).localReport();
}
export const hostingCommand = z.discriminatedUnion('action', [
  z.object({ action: z.literal('order'), key: z.uuid(), product: z.enum(Object.keys(PRODUCTS) as [HostingProduct,...HostingProduct[]]) }).strict(),
  z.object({ action: z.literal('status'), id: z.uuid(), status: z.enum(['payment_review','cancelled']) }).strict(),
  z.object({ action: z.literal('refresh') }).strict(),
]);
export async function changeHosting(raw: unknown) {
  const parsed=hostingCommand.safeParse(raw);
  if (!parsed.success) throw new BusinessError('Controleer je bestelling en probeer opnieuw.');
  const input=parsed.data;
  if (input.action==='refresh') return hostingReport();
  if (!cloudMode()) {
    if (process.env.NODE_ENV==='production') throw new BusinessError('Online opslag ontbreekt.',503);
    return (await import('./local')).localCommand(input);
  }
  if (input.action==='order') await hostingRpc('lothuus_hosting_order',{order_id:input.key,product_code:input.product,epc_payload:paymentPayload(input.product)});
  else await hostingRpc('lothuus_hosting_order_status',{order_id:input.id,next_status:input.status});
  return hostingReport();
}
export async function registerHostingMedia(records: {key:string;bytes:number}[]) {
  if (cloudMode()) await hostingRpc('lothuus_hosting_media',{records});
}
export async function refreshHosting(force=false) {
  if (!cloudMode()) return { skipped:true };
  const jobId=randomUUID();
  const job=await hostingRpc('lothuus_hosting_claim',{job_id:jobId,force_refresh:force});
  if (!job) return { skipped:true };
  const results: Record<string,unknown>[]=[];
  let complete=false;
  try {
    try { const value=await hostingRpc('lothuus_hosting_database_bytes');if(!Number.isSafeInteger(value)||value<0)throw new Error('Invalid size');results.push({metric:'database',value,status:'ready'}); }
    catch { results.push({metric:'database',status:'error'}); }
    try {
      const {S3Client,ListObjectsV2Command}=await import('@aws-sdk/client-s3');
      if(!process.env.R2_ENDPOINT||!process.env.R2_ACCESS_KEY_ID||!process.env.R2_SECRET_ACCESS_KEY||!process.env.R2_BUCKET)throw new Error('Missing R2 configuration');
      const s3=new S3Client({region:'auto',endpoint:process.env.R2_ENDPOINT,credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY},maxAttempts:2});
      let cursor=job.scan_cursor || undefined;
      const deadline=Date.now()+35000;
      do {
        const page=await s3.send(new ListObjectsV2Command({Bucket:process.env.R2_BUCKET,MaxKeys:1000,ContinuationToken:cursor}),{abortSignal:AbortSignal.timeout(12000)});
        const records=(page.Contents||[]).filter(o=>/^(originals|variants)\//.test(o.Key||'')).map(o=>({key:o.Key!,bytes:o.Size!}));
        if(records.some(o=>!Number.isSafeInteger(o.bytes)||o.bytes<0))throw new Error('Invalid object size');
        const next=page.IsTruncated ? page.NextContinuationToken : null;
        if(page.IsTruncated&&!next)throw new Error('Missing pagination cursor');
        complete=await hostingRpc('lothuus_hosting_scan_page',{job_id:jobId,records,next_cursor:next});
        cursor=next||undefined;
      }while(!complete && Date.now()<deadline);
    } catch(error) { console.error('[hosting] media reconciliation failed',error instanceof BusinessError?'database':'storage'); results.push({metric:'media',status:'error'}); }
    try {
      if(process.env.CLOUDFLARE_ANALYTICS_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID){
        const {cloudflareTraffic}=await import('./traffic');
        const traffic=await cloudflareTraffic();
        await hostingRpc('lothuus_hosting_traffic',{days:traffic.days});
        results.push({metric:'direct',value:traffic.value,status:'ready',periodStart:traffic.start,periodEnd:traffic.end});
      }
    } catch { console.error('[hosting] traffic refresh failed');results.push({metric:'direct',status:'error'}); }
  } finally { await hostingRpc('lothuus_hosting_finish',{job_id:jobId,results,scan_complete:complete}); }
  return {complete,failed:results.some(result=>result.status==='error')};
}
