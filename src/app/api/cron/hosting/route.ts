import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { refreshHosting } from '@/lib/hosting/server';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request:NextRequest){const secret=process.env.CRON_SECRET;const actual=Buffer.from(request.headers.get('authorization')||'');const expected=Buffer.from(`Bearer ${secret}`);if(!secret||actual.length!==expected.length||!timingSafeEqual(actual,expected))return NextResponse.json({error:'Niet toegestaan.'},{status:401});try{const result=await refreshHosting();return NextResponse.json(result,{status:'failed' in result && result.failed?503:200,headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'Meten is niet gelukt.'},{status:503});}}
