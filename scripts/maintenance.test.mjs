import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = (name, directory, ...args) => execFileSync(process.execPath, [fileURLToPath(new URL(name, import.meta.url)), ...args], { env: { ...process.env, LOTHUUS_DATA_DIR: directory }, stdio: 'pipe' });

test('photo cleanup preserves every order line, source photo and heart snapshot', () => {
  const directory = mkdtempSync(join(tmpdir(), 'lothuus-cleanup-'));
  try {
    mkdirSync(join(directory, 'images'));
    const ids = Array.from({ length: 6 }, () => randomUUID());
    const image = id => `/api/images/${id}?size=thumb`;
    const db = new DatabaseSync(join(directory, 'lothuus.sqlite'));
    db.exec('CREATE TABLE app_state(id INTEGER PRIMARY KEY, body TEXT)');
    db.prepare('INSERT INTO app_state VALUES(1,?)').run(JSON.stringify({ items: [{ photos: [], sourcePhotos: [{ id: ids[0] }] }], reservations: [{ image: image(ids[1]), lines: [{ image: image(ids[1]) }, { image: image(ids[2]) }] }] }));
    db.close();
    const hearts = new DatabaseSync(join(directory, 'hearts.sqlite'));
    hearts.exec('CREATE TABLE hearts(id INTEGER PRIMARY KEY, body TEXT)');
    hearts.prepare('INSERT INTO hearts VALUES(1,?)').run(JSON.stringify({ objects: [{ image: image(ids[3]) }] })); hearts.close();
    for (const [index, id] of ids.entries()) {
      const path = join(directory, 'images', `${id}-thumb.webp`); writeFileSync(path, id);
      if (index !== 5) utimesSync(path, new Date(0), new Date(0));
    }
    run('cleanup-images.mjs', directory);
    ids.slice(0, 4).forEach(id => assert.equal(existsSync(join(directory, 'images', `${id}-thumb.webp`)), true));
    assert.equal(existsSync(join(directory, 'images', `${ids[4]}-thumb.webp`)), false);
    assert.equal(existsSync(join(directory, 'images', `${ids[5]}-thumb.webp`)), true);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('local backup restores all databases including uncheckpointed WAL data', () => {
  const directory = mkdtempSync(join(tmpdir(), 'lothuus-backup-')), connections = [];
  try {
    const source = join(directory, 'data'), destination = join(directory, 'backup'); mkdirSync(source);
    for (const name of ['lothuus', 'hearts', 'hosting', 'analytics']) {
      const db = new DatabaseSync(join(source, `${name}.sqlite`)); connections.push(db);
      db.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0; CREATE TABLE snapshot(value TEXT)');
      db.prepare('INSERT INTO snapshot VALUES(?)').run(name);
    }
    mkdirSync(join(source, 'images')); writeFileSync(join(source, 'images', 'photo.webp'), 'photo');
    run('backup.mjs', source, destination);
    for (const name of ['lothuus', 'hearts', 'hosting', 'analytics']) {
      const db = new DatabaseSync(join(destination, `${name}.sqlite`), { readOnly: true });
      try { assert.equal(db.prepare('SELECT value FROM snapshot').get().value, name); } finally { db.close(); }
    }
    assert.equal(readFileSync(join(destination, 'images', 'photo.webp'), 'utf8'), 'photo');
  } finally { connections.forEach(db => db.close()); rmSync(directory, { recursive: true, force: true }); }
});
