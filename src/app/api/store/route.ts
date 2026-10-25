import { NextRequest, NextResponse } from 'next/server';
import { readJson, requireOwner, sameOrigin } from '@/lib/backend/auth';
import { cloudMode, serverDatabase, withStore } from '@/lib/backend/cloud';
import { adminView, command, reviewOverdue, safeError } from '@/lib/backend/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    await requireOwner(request);
    const stamp=async()=>{const r=await serverDatabase().rpc('lothuus_state_stamp');return !r.error && r.data ? `"${r.data}"` : undefined;};
    const tag=cloudMode()?await stamp():undefined;
    const matches = (request.headers.get('if-none-match') || '').split(',').map(value => value.trim().replace(/^W\//, ''));
    if(tag && (matches.includes(tag) || matches.includes('*'))) return new NextResponse(null,{status:304,headers:{'Cache-Control':'private, no-store','ETag':tag}});
    let revision: number | undefined;
    const {data,at}=await withStore(s=>{reviewOverdue(s);return {data:adminView(s),at:Date.now()};},value=>{revision=value;});
    // Tag the exact snapshot returned, even when another writer commits immediately afterwards.
    const finalTag=revision === undefined ? undefined : `"${revision}${data.reservations.some(r=>r.status==='active') ? ':'+Math.floor(at/60000) : ''}"`;
    return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store',...(finalTag?{'ETag':finalTag}:{})}});
  }
  catch (e) { const error = safeError(e); return NextResponse.json({ error: error.message }, { status: error.status }); }
}
export async function POST(request: NextRequest) {
  try { sameOrigin(request); await requireOwner(request); const input = await readJson(request); return NextResponse.json(await withStore(s => { command(s, input); return adminView(s); }), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (e) { const error = safeError(e); return NextResponse.json({ error: error.message }, { status: error.status }); }
}
