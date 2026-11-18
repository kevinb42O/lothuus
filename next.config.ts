import type { NextConfig } from 'next';
// Signing uses path-style R2 URLs, so the browser only needs this exact origin.
const r2ImageOrigin = (() => {
  if (process.env.R2_DIRECT_DELIVERY !== 'true' || !process.env.R2_ENDPOINT) return '';
  try {
    const url = new URL(process.env.R2_ENDPOINT);
    return url.protocol === 'https:' && /^[a-f0-9]+(?:\.eu)?\.r2\.cloudflarestorage\.com$/.test(url.hostname) && url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password && !url.port ? ` ${url.origin}` : '';
  } catch { return ''; }
})();
const config: NextConfig = {
  distDir: process.env.LOTHUUS_BUILD_DIR || '.next',
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: [
      ...(process.env.NODE_ENV === 'production' ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }] : []),
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Content-Security-Policy', value: process.env.NODE_ENV === 'production' ? `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:${r2ImageOrigin}; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests` : "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
    ] }, { source: '/admin/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }, { source: '/reservation', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }];
  },
};
export default config;
