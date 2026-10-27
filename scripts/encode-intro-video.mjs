import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, rename, stat, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { introRenderSources } from './lib/intro-render-sources.mjs';

const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
const frames = resolve(process.argv[2] || join(tmpdir(), 'lothuus-cinematic-render'));
const output = resolve('public/house/video'), staging = join(output, '.cinematic-staging');
const manifest = JSON.parse(await readFile(join(frames, 'render.json'), 'utf8'));
if (!manifest.complete) throw new Error('Capture is incomplete');
if (JSON.stringify(manifest.sources) !== JSON.stringify(await introRenderSources())) throw new Error('The captured scene does not match current source code');
await mkdir(staging, { recursive: true });
const sizes = { desktop: [1920, 1200], mobile: [720, 1560] };
const files = [];
for (const variant of ['desktop', 'mobile']) {
  for (let frame = 0; frame < manifest.frames; frame++) {
    const file = await open(join(frames, variant, `${String(frame).padStart(4, '0')}.png`));
    try {
      const header = Buffer.alloc(24); await file.read(header, 0, 24, 0);
      if (header.readUInt32BE(0) !== 0x89504e47 || header.readUInt32BE(16) !== sizes[variant][0] || header.readUInt32BE(20) !== sizes[variant][1])
        throw new Error(`Invalid or mismatched frame: ${variant}/${frame}`);
    } finally { await file.close(); }
  }
  const input = ['-hide_banner', '-loglevel', 'warning', '-y', '-framerate', String(manifest.fps), '-i', join(frames, variant, '%04d.png'), '-frames:v', String(manifest.frames), '-an'];
  const formats = {
    webm: ['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', variant === 'desktop' ? '8000k' : '4500k', '-crf', '22', '-maxrate', variant === 'desktop' ? '14000k' : '8000k', '-bufsize', variant === 'desktop' ? '28000k' : '16000k', '-row-mt', '1', '-threads', '4', '-cpu-used', '4', '-auto-alt-ref', '0'],
    mov: ['-c:v', 'hevc_videotoolbox', '-alpha_quality', '.95', '-b:v', variant === 'desktop' ? '10000k' : '6000k', '-tag:v', 'hvc1', '-pix_fmt', 'bgra', '-movflags', '+faststart'],
  };
  for (const [extension, codec] of Object.entries(formats)) {
    const file = `entrance-${variant}.${extension}`;
    console.log(`Encoding ${file}`);
    const result = spawnSync(ffmpeg, [...input, ...codec, join(staging, file)], { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status) process.exit(result.status);
    files.push(file);
  }
}
// Publish only after ALL encodes succeed; a codec failure preserves every old film.
for (const file of files) await rename(join(staging, file), join(output, file));
const bytes = Object.fromEntries(await Promise.all(files.map(async file => [file, (await stat(join(output, file))).size])));
await writeFile(join(output, 'sources.json'), JSON.stringify({ created: new Date().toISOString(), fps: manifest.fps, frames: manifest.frames, duration: manifest.duration, ...sizes, master: { desktop: [2880, 1800], mobile: [1080, 2340] }, alpha: true, renderer: manifest.renderer, provenance: 'Deterministic offline frame export of the authored LOTHUUS house; no product imagery is embedded. The homepage reveals its current live collection through RGBA alpha.', renderSeconds: Object.fromEntries(Object.entries(manifest.variants).map(([key, value]) => [key, value.seconds])), sources: manifest.sources, bytes }, null, 2) + '\n');
console.log('All four cinematic videos are installed.');
