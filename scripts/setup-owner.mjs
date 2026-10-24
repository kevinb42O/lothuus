import { createInterface } from 'node:readline/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomBytes, scryptSync } from 'node:crypto';
import { resolve, join } from 'node:path';
const terminal = createInterface({ input: process.stdin, output: process.stdout });
try {
  const password = await terminal.question('Nieuw eigenaarswachtwoord (minimaal 12 tekens; invoer is zichtbaar): ');
  if (password.length < 12 || password.length > 200) throw new Error('Gebruik 12 tot 200 tekens. Er is niets gewijzigd.');
  const confirmation = await terminal.question('Herhaal wachtwoord: ');
  if (confirmation !== password) throw new Error('Wachtwoorden verschillen. Er is niets gewijzigd.');
  const directory = resolve(process.env.LOTHUUS_DATA_DIR || '.data'); mkdirSync(directory, { recursive: true, mode: 0o700 });
  const salt = randomBytes(16).toString('hex');
  writeFileSync(join(directory, 'owner.json'), JSON.stringify({ salt, hash: scryptSync(password, salt, 64).toString('hex'), secret: randomBytes(32).toString('hex') }), { mode: 0o600 });
  console.log('Wachtwoord ingesteld. Open /admin om in te loggen. Bestaande sessies zijn ingetrokken.');
} catch (e) { console.error(e.message); process.exitCode = 1; } finally { terminal.close(); }
