import type { CookieOptions } from '@supabase/ssr';

export const rememberCookie = 'lothuus-remember';
export const rememberedSessionSeconds = 30 * 24 * 3600;
export const browserSessionSeconds = 8 * 3600;

// Supabase supplies its own persistent expiry on sign-in and token refresh.
// Apply the owner's choice at the final cookie write, preserving deletions.
export function sessionCookieLifetime(options: CookieOptions, remember: boolean): CookieOptions {
  if (options.maxAge === 0) return options;
  const { maxAge: _maxAge, expires: _expires, ...sessionOptions } = options;
  return remember ? { ...sessionOptions, maxAge: rememberedSessionSeconds } : sessionOptions;
}
