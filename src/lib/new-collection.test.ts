import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { scanSource, importRecord } from '../../scripts/lib/new-collection';
import { initialStore } from './backend/repository';
import { checkoutSchema } from './backend/validation';
import { materialGroups } from './inventory';
import { categories, objects } from './collection';

test('each catalogue category has exactly one filter and every supplied object has a category', () => {
  const ids = categories.map(c => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const object of objects) assert(ids.includes(object.category), object.id);
});

test('delivery scanning uses natural order and imports only the first eight photos', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lothuus-delivery-'));
  try {
    const image = await sharp({ create: { width: 10, height: 12, channels: 3, background: '#ddd' } }).jpeg().toBuffer();
    for (const [category, count] of [['inox, ijzer,...', 5], ['plastic', 13], ['textiel', 8]] as const) {
      const dir = join(root, category, 'naamloze map'); await mkdir(dir, { recursive: true });
      for (let i = 1; i <= count; i++) await writeFile(join(dir, i === 4 ? '4`.jpg' : `${i}.jpg`), image);
    }
    const records = await scanSource(root);
    assert.deepEqual(records.map(r => [r.reference, r.category, r.photos.length]), [['I001','inox-ijzer',5],['P001','plastiek',8],['T001','textiel',8]]);
    const plastic = records[1];
    assert.deepEqual(plastic.photos.map(p => p.path.split('/').at(-1)), ['1.jpg','2.jpg','3.jpg','4`.jpg','5.jpg','6.jpg','7.jpg','8.jpg']);
    assert.deepEqual(plastic.omitted, ['9.jpg','10.jpg','11.jpg','12.jpg','13.jpg']);
    const state = initialStore();
    // Numbering follows the permanent counter; source code and product number are distinct.
    state.itemNumbers = { P: 17 };
    for (const record of records) {
      const photos = record.photos.map(p => ({ id: randomUUID(), alt: p.alt }));
      const item = importRecord(state, record, photos);
      assert.equal(item.publication, 'draft'); assert.equal(item.priceUnset, true);
      assert.equal(item.sourcePhotos?.length, photos.length);
      assert.equal(item.sourcePhotoCount, photos.length);
      item.title = 'Handmatig gewijzigd'; item.photos = item.photos.slice(0, 2); item.version++;
      assert.equal(importRecord(state, record, photos), item);
      assert.equal(item.title, 'Handmatig gewijzigd'); assert.equal(item.photos.length, 2);
      assert.equal(materialGroups.find(g => g.code === record.prefix)?.category, record.category);
    }
    assert.equal(state.items.length, 3); assert.equal(state.items.find(i => i.materialGroup === 'P')?.productNumber, 'P18');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('checkout accepts all six source code families and rejects invented families', () => {
  const base = { contact: { name:'Test',email:'test@example.test',phone:'',channel:'email' }, message:'',termsVersion:'1',accepted:true,website:'',key:randomUUID() };
  for (const prefix of ['K','P','G','T','H','I']) assert.equal(checkoutSchema.safeParse({ ...base, items:[{itemId:`${prefix}001`,expectedPrice:null,expectedVersion:1}] }).success,true,prefix);
  assert.equal(checkoutSchema.safeParse({ ...base, items:[{itemId:'Z001',expectedPrice:null,expectedVersion:1}] }).success,false);
});
