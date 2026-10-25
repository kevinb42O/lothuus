import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { refreshHosting } from '@/lib/hosting/server';
import { dailyCloudBackup } from '@/lib/maintenance/backup';
import { refreshSupabaseUsage } from '@/lib/maintenance/usage';
export const runtime='nodejs';
export const maxDuration=300;
export async function GET(request:NextRequest){
 const secret=process.env.CRON_SECRET,actual=Buffer.from(request.headers.get('authorization')||''),expected=Buffer.from(`Bearer ${secret}`);
 if(!secret||actual.length!==expected.length||!timingSafeEqual(actual,expected))return NextResponse.json({error:'Niet toegestaan.'},{status:401});
 const results=await Promise.allSettled([dailyCloudBackup(),refreshSupabaseUsage(),refreshHosting()]);
 const failed=results.some(r=>r.status==='rejected'||'failed' in r.value&&r.value.failed);
 // Return only operational status, never backup contents or provider credentials.
 return NextResponse.json({backup:results[0].status==='fulfilled'?results[0].value:{failed:true},usage:results[1].status==='fulfilled'?results[1].value:{failed:true},hosting:results[2].status==='fulfilled'?results[2].value:{failed:true}},{status:failed?503:200,headers:{'Cache-Control':'no-store'}});
}
