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
  const { client, email } = await requireOperator(false);
  const factors = await client.auth.mfa.listFactors();
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (factors.error || assurance.error) throw new BusinessError('De beveiligingscontrole is tijdelijk niet beschikbaar.', 503);
  return { authenticated: true, email, verified: assurance.data?.currentLevel === 'aal2', factorId: factors.data.totp[0]?.id || null };
}
export async function GET() {
  try { return NextResponse.json(await status(), { headers }); }
  catch (e) { const error = safeError(e); if (error.status === 401) return NextResponse.json({ authenticated: false }, { headers }); return NextResponse.json({ error: error.message }, { status: error.status, headers }); }
}
const inputSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('login'), email: z.string().email().max(180), password: z.string().min(1).max(200) }).strict(),
  z.object({ action: z.literal('enroll') }).strict(),
  z.object({ action: z.literal('verify'), factorId: z.uuid(), code: z.string().regex(/^\d{6}$/) }).strict(),
]);
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request); await throttle(request, 'superadmin-auth', 20);
    const parsed = inputSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new BusinessError('Controleer de ingevulde gegevens.');
    const input = parsed.data;
    if (input.action === 'login') {
      if (input.email.trim().toLowerCase() !== 'kevin@webaanzee.be') throw new BusinessError('Het e-mailadres of wachtwoord klopt niet.', 401);
      const client = await operatorClient();
      const result = await client.auth.signInWithPassword({ email: input.email.trim().toLowerCase(), password: input.password });
      if (result.error || !operatorIdentity(result.data.user)) { await client.auth.signOut({ scope: 'local' }); throw new BusinessError('Het e-mailadres of wachtwoord klopt niet.', 401); }
      try { await requireOperator(false); } catch (error) { await client.auth.signOut({ scope: 'local' }); throw error; }
    } else {
      const { client, actor } = await requireOperator(false);
      const factors = await client.auth.mfa.listFactors();
      if (factors.error) throw new BusinessError('De authenticator is tijdelijk niet beschikbaar.', 503);
      if (input.action === 'enroll') {
        if (factors.data.totp.length) throw new BusinessError('Er is al een authenticator gekoppeld. Gebruik je bestaande code.', 409);
        // Retry interrupted setup without accumulating unusable factors.
        for (const factor of factors.data.all.filter(f => f.factor_type === 'totp' && f.status === 'unverified')) {
          const removed = await client.auth.mfa.unenroll({ factorId: factor.id });
          if (removed.error) throw new BusinessError('De vorige instelling kon niet worden vernieuwd.', 503);
        }
        const result = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'LOTHUUS superadmin', issuer: 'LOTHUUS' });
        if (result.error) throw new BusinessError('Authenticator instellen is niet gelukt.', 503);
        return NextResponse.json({ factorId: result.data.id, qr: `data:image/svg+xml;base64,${Buffer.from(result.data.totp.qr_code.replace(/^data:image\/svg\+xml;utf-8,/, '')).toString('base64')}`, secret: result.data.totp.secret }, { headers });
      }
      if (!factors.data.all.some(f => f.id === input.factorId && f.factor_type === 'totp')) throw new BusinessError('Deze authenticator hoort niet bij je account.', 403);
      const verified = await client.auth.mfa.challengeAndVerify({ factorId: input.factorId, code: input.code });
      if (verified.error) throw new BusinessError('De code klopt niet of is verlopen. Probeer de nieuwste code.');
      await requireOperator(true);
      await recordActivity(actor, 'superadmin_login', undefined, 'Superadmin aangemeld met tweestapsverificatie');
    }
    return NextResponse.json(await status(), { headers });
  } catch (e) { const error = safeError(e); return NextResponse.json({ error: error.message }, { status: error.status, headers }); }
}
export async function DELETE(request: NextRequest) {
  try { sameOrigin(request); const client = await operatorClient(); await client.auth.signOut({ scope: 'local' }); return NextResponse.json({ authenticated: false }, { headers }); }
  catch (e) { const error = safeError(e); return NextResponse.json({ error: error.message }, { status: error.status, headers }); }
}
