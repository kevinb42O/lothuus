import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { introRenderSources } from './lib/intro-render-sources.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const sharp = require('sharp');
const origin = process.env.INTRO_RENDER_ORIGIN || 'http://127.0.0.1:3001';
const output = join(tmpdir(), 'lothuus-cinematic-render');
const fps = 60, duration = 16, frames = fps * duration;
const sources = await introRenderSources();
const signature = createHash('sha256').update(JSON.stringify(sources)).digest('hex');
await mkdir(output, { recursive: true });
const manifestPath = join(output, 'render.json');
let previous;
try { previous = JSON.parse(await readFile(manifestPath, 'utf8')); } catch {}
const resume = process.argv.includes('--resume');
if (resume && previous?.signature !== signature) throw new Error('Cannot resume frames from another scene version');
const manifest = { signature, created: new Date().toISOString(), fps, duration, frames, sources, variants: resume ? (previous?.variants ?? {}) : {}, renderer: 'Three.js offline cinematic raster; HDR PBR, depth-derived GTAO, 8192px sun shadows, 1.5× spatial supersampling, 4× MSAA including lettering, deterministic wind' };
await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'],
});
try {
  for (const variant of ['desktop', 'mobile']) {
    const started = Date.now(), errors = [];
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
    // The production capture reads immutable local assets directly. Avoid HTTP
    // development-server interruptions corrupting GLTF texture loading mid-job.
    await page.route('**/house/**', async route => {
      const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
      const file = resolve('public', `.${pathname}`);
      if (!file.startsWith(`${resolve('public/house')}/`)) return route.abort();
      const extension = file.split('.').at(-1);
      const mime = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[extension] || 'application/octet-stream';
      await route.fulfill({ body: await readFile(file), contentType: mime });
    });
    await page.route('**/api/intro-render?**', async route => {
      const request = route.request(), query = new URL(request.url()).searchParams;
      if (request.method() !== 'POST' || query.get('variant') !== variant) return route.abort();
      const frame = Number(query.get('frame'));
      if (!Number.isInteger(frame) || frame < 0 || frame > frames) return route.abort();
      const [width, height] = variant === 'desktop' ? [1920, 1200] : [720, 1560];
      const directory = join(output, variant);
      await mkdir(directory, { recursive: true });
      await sharp(request.postDataBuffer()).resize(width, height, { kernel: 'lanczos3' }).png({ compressionLevel: 6 }).toFile(join(directory, `${String(frame).padStart(4, '0')}.png`));
      await route.fulfill({ status: 204, body: '' });
    });
    page.on('requestfailed', request => console.log(`Request failed: ${request.url()} ${request.failure()?.errorText}`));
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && /THREE|WebGL|shader|context/i.test(message.text())) errors.push(message.text()); });
    await page.goto(`${origin}/intro-render?variant=${variant}`);
    await page.waitForFunction(() => typeof window.renderIntroFrames === 'function', null, { timeout: 180000 });
    const projections = [], existing = new Set(resume ? await readdir(join(output, variant)).catch(() => []) : []);
    for (let start = 0; start <= frames; start += 24) {
      const end = Math.min(frames + 1, start + 24);
      const complete = resume && Array.from({ length: end - start }, (_, i) => `${String(start + i).padStart(4, '0')}.png`).every(file => existing.has(file));
      if (!complete) {
        let result;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            result = await page.evaluate(([start, end]) => window.renderIntroFrames(start, end), [start, end]);
            break;
          } catch (error) {
            if (attempt === 2 || !/Failed to fetch|context was destroyed/.test(String(error))) throw error;
            console.log(`Retrying ${variant} batch ${start} after a development-server connection interruption`);
            errors.length = 0;
            await page.reload();
            await page.waitForFunction(() => typeof window.renderIntroFrames === 'function', null, { timeout: 180000 });
          }
        }
        projections.push(...result.projections.map((projection, i) => ({ frame: start + i, ...projection })));
      }
      if (errors.length) throw new Error(errors.join('\n'));
      console.log(`${variant}: ${end}/${frames + 1} frames · ${((Date.now() - started) / 1000).toFixed(1)}s`);
    }
    manifest.variants[variant] = { seconds: (Date.now() - started) / 1000, projections };
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    await page.close();
  }
  if (JSON.stringify(sources) !== JSON.stringify(await introRenderSources())) throw new Error('Scene changed during capture; do not encode mixed frames');
  manifest.complete = true;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Complete: ${resolve(output)}`);
} finally { await browser.close(); }
