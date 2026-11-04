import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cloudMode, serverDatabase } from '../backend/cloud';
import { BusinessError } from '../backend/service';

export const operatorCookie = 'lothuus-superadmin-session';
export async function operatorClient() {
  if (!cloudMode() || !process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) throw new BusinessError('Superadmin is nog niet beschikbaar.', 503);
  const jar = await cookies();
  return createServerClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: { name: operatorCookie, path: '/api/superadmin', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store', signal: AbortSignal.timeout(15000) }) },
    cookies: { getAll: () => jar.getAll(), setAll: values => { for (const { name, value, options } of values) {
      // A browser-session cookie for the operator, independent of the owner cookie.
      const { maxAge, expires: _expires, ...rest } = options;
      jar.set(name, value, { ...rest, ...(maxAge === 0 ? { maxAge: 0 } : {}), path: '/api/superadmin', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
    } } },
  });
}
export function operatorIdentity(user: { id: string; email?: string; app_metadata?: Record<string, unknown> } | null) {
  return user?.app_metadata?.role === 'superadmin' && user.email?.toLowerCase() === 'kevin@webaanzee.be' ? user.id : null;
}
export async function requireOperator(mfa = true) {
  const client = await operatorClient();
  const { data, error } = await client.auth.getUser();
  const actor = error ? null : operatorIdentity(data.user);
  if (!actor) throw new BusinessError('Log in met je superadminaccount.', 401);
  const enabled = await serverDatabase().rpc('lothuus_operator_enabled', { actor });
  if (enabled.error) throw new BusinessError('De toegangscontrole is tijdelijk niet beschikbaar.', 503);
  if (enabled.data !== true) throw new BusinessError('Dit account heeft geen superadmintoegang.', 403);
  if (mfa) {
    const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error || assurance.data?.currentLevel !== 'aal2') throw new BusinessError('Bevestig eerst je authenticatorcode.', 403);
  }
  return { client, actor, email: data.user!.email! };
}
