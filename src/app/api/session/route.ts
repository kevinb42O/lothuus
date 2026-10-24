import { NextRequest, NextResponse } from 'next/server';
import { authenticate, configured, isOwner, readJson, sameOrigin, sessionCookie, throttle } from '@/lib/backend/auth';
import { cloudMode } from '@/lib/backend/cloud';
import { authClient } from '@/lib/backend/auth';
import { BusinessError, safeError } from '@/lib/backend/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) { return NextResponse.json({ authenticated: await isOwner(request), configured: await configured(), local: !cloudMode(), email: cloudMode() ? process.env.ADMIN_EMAIL : undefined }, { headers: { 'Cache-Control': 'no-store' } }); }
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request); await throttle(request, 'login', 15);
    const input = await readJson(request);
    if (typeof input.password !== 'string' || input.password.length > 200) throw new BusinessError('Vul je wachtwoord in.');
    const token = await authenticate(input.password, typeof input.email === 'string' ? input.email : '');
    const response = NextResponse.json({ authenticated: true });
    if (token) response.cookies.set(sessionCookie, token, { httpOnly: true, secure: request.nextUrl.protocol === 'https:', sameSite: 'strict', maxAge: 8 * 3600, path: '/' }); return response;
  } catch (e) { const error = safeError(e); return NextResponse.json({ error: error.message }, { status: error.status }); }
}
export async function DELETE(request: NextRequest) {
  try { sameOrigin(request); if (cloudMode()) { const client = await authClient(); await client.auth.signOut({scope:'local'}); } const response = NextResponse.json({ authenticated: false }); response.cookies.set(sessionCookie, '', { maxAge: 0, path: '/' }); return response; }
  catch (e) { const error = safeError(e); return NextResponse.json({ error: error.message }, { status: error.status }); }
}
