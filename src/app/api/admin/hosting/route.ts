import { after, NextRequest, NextResponse } from 'next/server';
import { readJson, requireOwner, sameOrigin, throttle } from '@/lib/backend/auth';
import { safeError } from '@/lib/backend/service';
import { changeHosting, hostingCommand, hostingReport, refreshHosting } from '@/lib/hosting/server';
export const runtime='nodejs';
export const maxDuration=60;
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:NextRequest){try{await requireOwner(request);return NextResponse.json(await hostingReport(),{headers});}catch(e){const error=safeError(e);return NextResponse.json({error:error.message},{status:error.status,headers});}}
export async function POST(request:NextRequest){try{sameOrigin(request);await requireOwner(request);await throttle(request,'hosting',40);const input=await readJson(request);const parsed=hostingCommand.safeParse(input);const report=await changeHosting(input);if(parsed.success&&parsed.data.action==='refresh')after(async()=>{try{await refreshHosting();}catch{console.error('[hosting] background refresh failed');}});return NextResponse.json(report,{headers});}catch(e){const error=safeError(e);return NextResponse.json({error:error.message},{status:error.status,headers});}}
