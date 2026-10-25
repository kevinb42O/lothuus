/** R2 origin downloads, not browser-cache hits or total Vercel delivery. */
export async function cloudflareTraffic() {
 const end=new Date().toISOString(),start=new Date(Date.UTC(new Date().getUTCFullYear(),new Date().getUTCMonth(),1)).toISOString();
 const account=process.env.CLOUDFLARE_ACCOUNT_ID,bucket=process.env.R2_BUCKET;
 if(!account||!bucket||!process.env.CLOUDFLARE_ANALYTICS_TOKEN)throw new Error('Traffic configuration missing');
 const jurisdiction=process.env.R2_ENDPOINT?.includes('.eu.r2.')?'eu_':'';
 const query=`query Traffic($account: string!, $bucket: string!, $start: Time!, $end: Time!) { viewer { accounts(filter:{accountTag:$account}) { r2OperationsAdaptiveGroups(limit:10000, filter:{bucketName:$bucket,datetime_geq:$start,datetime_lt:$end,actionType:"GetObject",actionStatus:"success"}) { sum { responseBytes } dimensions { date } } } } }`;
 const r=await fetch('https://api.cloudflare.com/client/v4/graphql',{method:'POST',headers:{Authorization:`Bearer ${process.env.CLOUDFLARE_ANALYTICS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query,variables:{account,bucket:jurisdiction+bucket,start,end}}),signal:AbortSignal.timeout(12000),cache:'no-store'});
 if(!r.ok)throw new Error('Traffic request failed');const result=await r.json();
 if(result.errors?.length)throw new Error('Traffic query unavailable');
 const groups=result.data?.viewer?.accounts?.[0]?.r2OperationsAdaptiveGroups;
 if(!Array.isArray(groups)||groups.length>=10000)throw new Error('Traffic result incomplete');
 const days=groups.map((g:{dimensions:{date:string};sum:{responseBytes:number}})=>({day:g.dimensions.date,bytes:g.sum.responseBytes}));
 if(days.some((d:{day:string;bytes:number})=>!/^\d{4}-\d{2}-\d{2}$/.test(d.day)||!Number.isSafeInteger(d.bytes)||d.bytes<0))throw new Error('Traffic result invalid');
 return {start,end,days,value:days.reduce((n:number,d:{bytes:number})=>n+d.bytes,0)};
}
