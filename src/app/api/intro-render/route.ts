import sharp from 'sharp';
import { HOUSE_ENTRY_DURATION } from '@/components/house-entry';
import { ENTRY_VIDEO_SIZE } from '@/lib/entry-video';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/** Local frame export only. This endpoint is unavailable in a production build. */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development') return new Response(null, { status: 404 });
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  if (!origin || new URL(origin).host !== request.headers.get('host')) return new Response(null, { status: 403 });
  const variant = url.searchParams.get('variant');
  const frame = url.searchParams.get('frame');
  if (!['desktop', 'mobile'].includes(variant || '') || !/^\d{1,4}$/.test(frame || '') || Number(frame) > HOUSE_ENTRY_DURATION * 60)
    return new Response(null, { status: 400 });
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length > 32_000_000 || bytes[0] !== 137 || bytes[1] !== 80 || bytes[2] !== 78 || bytes[3] !== 71)
    return new Response(null, { status: 400 });
  const directory = join(tmpdir(), 'lothuus-cinematic-render', variant!);
  await mkdir(directory, { recursive: true });
  const size = ENTRY_VIDEO_SIZE[variant as keyof typeof ENTRY_VIDEO_SIZE];
  const image = await sharp(bytes).resize(size.width, size.height, { kernel: 'lanczos3' }).png({ compressionLevel: 6 }).toBuffer();
  await writeFile(join(directory, `${frame!.padStart(4, '0')}.png`), image);
  return new Response(null, { status: 204 });
}
