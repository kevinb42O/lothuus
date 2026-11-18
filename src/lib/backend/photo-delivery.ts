import { NextRequest, NextResponse } from 'next/server';
import { cloudMode } from './cloud';

export type PhotoSize = 'thumb' | 'grid' | 'detail';
export const PHOTO_LINK_LIFETIME = 60;

/** Only called AFTER the route has established public access. Never signs originals. */
export async function publicPhotoRedirect(request: NextRequest, id: string, size: PhotoSize) {
  if (!cloudMode() || process.env.R2_DIRECT_DELIVERY !== 'true' || request.nextUrl.searchParams.get('delivery') === 'proxy') return null;
  const endpoint = process.env.R2_ENDPOINT, bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID, secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  let origin: URL;
  try { origin = new URL(endpoint); } catch { return null; }
  // Keep redirects and CSP restricted to the configured R2 API, never arbitrary hosts.
  if (origin.protocol !== 'https:' || !/^[a-f0-9]+(?:\.eu)?\.r2\.cloudflarestorage\.com$/.test(origin.hostname) || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password || origin.port) return null;
  if (!/^[a-f0-9-]{36}$/.test(id) || !['thumb', 'grid', 'detail'].includes(size)) return null;
  try {
    const [{ S3Client, GetObjectCommand }, { getSignedUrl }] = await Promise.all([
      import('@aws-sdk/client-s3'), import('@aws-sdk/s3-request-presigner'),
    ]);
    const client = new S3Client({ region: 'auto', endpoint: origin.origin, forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } });
    const location = await getSignedUrl(client, new GetObjectCommand({
      Bucket: bucket, Key: `variants/${id}-${size}.webp`,
      ResponseContentType: 'image/webp', ResponseCacheControl: 'private, no-cache',
    }), { expiresIn: PHOTO_LINK_LIFETIME });
    // A stored redirect could outlive its signature or bypass a later visibility check.
    return new NextResponse(null, { status: 302, headers: {
      Location: location, 'Cache-Control': 'private, no-store', 'Vary': 'Cookie',
      'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
    } });
  } catch {
    // A signing/configuration failure keeps the established server transport usable.
    return null;
  }
}
