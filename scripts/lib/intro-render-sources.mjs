import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';

/** Include every authored house module, the font contours, projection and capture endpoint. */
export async function introRenderSources() {
  const components = (await readdir('src/components')).filter(name => /^house-.*\.(ts|tsx)$/.test(name) && !/\.test\.|study|wide-after|window-before|window-after|profile/.test(name));
  const files = [...components.map(name => `src/components/${name}`), 'src/lib/entry-video.ts', 'src/app/api/intro-render/route.ts'];
  const values = await Promise.all(files.sort().map(async file => [file, createHash('sha256').update(await readFile(file)).digest('hex')]));
  return Object.fromEntries(values);
}
