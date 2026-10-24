/** Import supplied product folders without inventing product details or prices. */
import { readdir, mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import sharp from 'sharp';

sharp.concurrency(1);
const root = resolve(import.meta.dirname, '..');
const source = resolve(root, process.argv[2] || 'wetransfer_foto-mappen-info_2026-10-23_1101');
const groups = [
  { folder: 'keramiek', category: 'keramiek', label: 'Keramiek', prefix: 'K' },
  { folder: 'glas', category: 'glas', label: 'Glas', prefix: 'G' },
  { folder: 'hout:riet:bamboe', category: 'hout-riet-bamboe', label: 'Hout / riet / bamboe', prefix: 'H' },
];
const compare = (a, b) => a.localeCompare(b, 'nl', { numeric: true });
const collections = [];
let totalPhotos = 0;
for (const group of groups) {
  const folders = (await readdir(join(source, group.folder), { withFileTypes: true })).filter(d => d.isDirectory()).map(d => d.name).sort(compare);
  const records = [];
  for (const [index, folder] of folders.entries()) {
    const directory = join(source, group.folder, folder);
    const files = (await readdir(directory)).filter(f => /\.(jpe?g|png|webp)$/i.test(f)).sort(compare);
    if (!files.length) continue;
    const id = `${group.prefix}${String(index + 1).padStart(3, '0')}`;
    const destination = join(root, 'public', 'collection', id);
    await mkdir(destination, { recursive: true });
    const photos = await Promise.all(files.map(async (file, photoIndex) => {
      const photoId = `${id}-${String(photoIndex + 1).padStart(2, '0')}`;
      const src = `/collection/${id}/${photoId}.webp`;
      const input = join(directory, file);
      const output = join(root, 'public', src);
      const current = await stat(output).catch(() => null);
      if (!current || current.mtimeMs < (await stat(input)).mtimeMs) {
        await sharp(input).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 84 }).toFile(output);
      }
      return { id: photoId, src, alt: `${group.label} ${id}, foto ${photoIndex + 1}` };
    }));
    records.push({ id, title: `${group.label} · ${id}`, category: group.category, date: '', material: group.label, dimensions: '', maker: '', image: photos[0].src, source: '', credit: 'LOTHUUS', imageSource: relative(root, directory), license: '', description: '', photos });
    totalPhotos += photos.length;
  }
  console.log(`${group.label}: ${records.length} producten`);
  collections.push(records);
}
// Interleave materials in the full wall; filters retain the original folder order.
const records = [];
for (let i = 0; i < Math.max(...collections.map(c => c.length)); i++) for (const collection of collections) if (collection[i]) records.push(collection[i]);
await writeFile(join(root, 'src/lib/collection.json'), JSON.stringify(records, null, 2) + '\n');
console.log(`${records.length} producten, ${totalPhotos} foto's geïmporteerd.`);
