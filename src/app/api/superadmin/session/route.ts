import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { readJson, sameOrigin, throttle } from '@/lib/backend/auth';
import { BusinessError, safeError } from '@/lib/backend/service';
import { operatorClient, operatorIdentity, requireOperator } from '@/lib/superadmin/auth';
import { recordActivity } from '@/lib/superadmin/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store' };
async function status() {
 const { email } = await requireOperator();
 return { authenticated: true, email, verified: true };
}
export async function GET() {
 try { return NextResponse.json(await status(), { headers }); }
 catch (e) { const error = safeError(e); if (error.status === 401) return NextResponse.json({ authenticated: false }, { headers }); return NextResponse.json({ error: error.message }, { status: error.status, headers }); }
}
const inputSchema = z.object({ action: z.literal('login'), email: z.string().email().max(180), password: z.string().min(1).max(200) }).strict();
export async function POST(request: NextRequest) {
 try {
  sameOrigin(request); await throttle(request, 'superadmin-auth', 20);
  const parsed = inputSchema.safeParse(await readJson(request));
  if (!parsed.success) throw new BusinessError('Controleer de ingevulde gegevens.');
  const input = parsed.data;
  if (input.email.trim().toLowerCase() !== 'kevin@webaanzee.be') throw new BusinessError('Het e-mailadres of wachtwoord klopt niet.', 401);
  const client = await operatorClient();
  const result = await client.auth.signInWithPassword({ email: input.email.trim().toLowerCase(), password: input.password });
  if (result.error || !operatorIdentity(result.data.user)) { await client.auth.signOut({ scope: 'local' }); throw new BusinessError('Het e-mailadres of wachtwoord klopt niet.', 401); }
  try { const {actor}=await requireOperator(); await recordActivity(actor,'superadmin_login',undefined,'Superadmin aangemeld'); }
  catch (error) { await client.auth.signOut({ scope: 'local' }); throw error; }
  return NextResponse.json(await status(), { headers });
 } catch (e) { const error = safeError(e); return NextResponse.json({ error: error.message }, { status: error.status, headers }); }
}
export async function DELETE(request: NextRequest) {
 try { sameOrigin(request); const client = await operatorClient(); await client.auth.signOut({ scope: 'local' }); return NextResponse.json({ authenticated: false }, { headers }); }
 catch (e) { const error = safeError(e); return NextResponse.json({ error: error.message }, { status: error.status, headers }); }
}
