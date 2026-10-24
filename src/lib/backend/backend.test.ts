import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { transact, initialStore } from './repository';
import { adminView, catalogue, command, publicReservation, ready, reserve, reviewOverdue } from './service';
import { availability, netPaid, type Store } from './types';
import { validIban } from './validation';
const directory = mkdtempSync(join(tmpdir(), 'lothuus-tests-'));
const photoId = randomUUID();
before(() => { process.env.LOTHUUS_DATA_DIR = directory; mkdirSync(join(directory, 'images')); writeFileSync(join(directory, 'images', `${photoId}-detail.webp`), 'test fixture'); });
after(() => { delete process.env.LOTHUUS_DATA_DIR; rmSync(directory, { recursive: true, force: true }); });
function fixture() {
  const s = initialStore();
  s.settings = { ...s.settings, ownerEmail: 'owner@example.com', replyTo: 'owner@example.com', beneficiary: 'Test', iban: 'BE68539007547034', terms: 'Testvoorwaarden', privacy: 'Testprivacy', reservationsEnabled: true };
  command(s, { action: 'save-item', item: { title: 'Testobject', category: 'keramiek', description: 'Een testobject', priceCents: 18500, date: '', material: '', dimensions: '', maker: '', condition: 'Test', publication: 'published', photos: [{ id: photoId, alt: 'Testfoto' }] } });
  return s;
}
function payload(s: Store, email = 'customer@example.com') { return { itemId: s.items[0].id, expectedPrice: s.items[0].priceCents, expectedVersion: s.items[0].version, contact: { name: 'Test Klant', email, phone: '', channel: 'email' }, emailConfirmation: email, message: 'Een test', termsVersion: s.settings.termsVersion, accepted: true, website: '', key: randomUUID() }; }
test('IBAN checksum and complete settings gate online reservations', () => { assert.equal(validIban('BE68539007547034'), true); assert.equal(validIban('BE68539007547035'), false); assert.equal(ready(initialStore()), false); assert.equal(ready(fixture()), true); });
test('reservation blocks stock and creates two separate local email previews', () => { const s = fixture(); const result = reserve(s, payload(s)); assert.equal(availability(s, s.items[0].id), 'reserved'); assert.equal(s.emails.length, 2); assert.deepEqual(s.emails.map(m => m.to).sort(), ['customer@example.com', 'owner@example.com']); assert.equal(netPaid(s.reservations[0]), 0); assert.ok(s.emails.find(m => m.kind === 'customer')!.body.includes(`/reservation#${result.token}`)); assert.ok(!s.emails.find(m => m.kind === 'owner')!.body.includes(result.token!)); });
test('idempotent retry recovers original token and rejects changed payload', () => { const s = fixture(); const input = payload(s); const first = reserve(s, input); assert.deepEqual(reserve(s, input), first); assert.equal(s.reservations.length, 1); assert.equal(s.emails.length, 2); assert.throws(() => reserve(s, { ...input, message: 'changed' }), /aanvraagcode/); });
test('a competing buyer cannot reserve the same item', () => { const s = fixture(); reserve(s, payload(s)); assert.throws(() => reserve(s, payload(s, 'other@example.com')), /gereserveerd of verkocht/); assert.equal(s.customers.length, 1); assert.equal(s.emails.length, 2); });
test('stale price, terms, mismatched email and honeypot are rejected', () => { const s = fixture(); const p = payload(s); assert.throws(() => reserve(s, { ...p, expectedPrice: 1 }), /gewijzigd/); assert.throws(() => reserve(s, { ...p, termsVersion: 'old' }), /voorwaarden/); assert.throws(() => reserve(s, { ...p, emailConfirmation: 'wrong@example.com' })); assert.throws(() => reserve(s, { ...p, website: 'spam' })); assert.equal(s.reservations.length, 0); });
test('anonymous returning contacts do not overwrite established customer information', () => { const s = fixture(); reserve(s, payload(s)); const r = s.reservations[0]; command(s, { action: 'reservation', id: r.id, version: r.version, operation: 'cancel' }); const second = payload(s); second.contact.name = 'Different name'; reserve(s, second); assert.equal(s.customers.length, 1); assert.equal(s.customers[0].name, 'Test Klant'); assert.equal(s.reservations[0].contact.name, 'Different name'); });
test('immutable reservation price and bank snapshots survive settings edits', () => { const s = fixture(); reserve(s, payload(s)); s.settings.iban = 'NEW'; s.items[0].priceCents = 1; assert.equal(s.reservations[0].priceCents, 18500); assert.equal(s.reservations[0].bank.iban, 'BE68539007547034'); });
test('partial payment prevents release; refund permits cancellation', () => { const s = fixture(); reserve(s, payload(s)); const r = s.reservations[0]; const input = { action: 'payment', id: r.id, version: r.version, key: randomUUID(), type: 'receipt', amountCents: 5000, date: new Date().toISOString(), note: '' }; command(s, input); command(s, input); assert.equal(r.payments.length, 1); assert.throws(() => command(s, { action: 'reservation', id: r.id, version: r.version, operation: 'cancel' }), /terugbetaling/); assert.throws(() => command(s, { action: 'reservation', id: r.id, version: r.version, operation: 'complete' }), /volledige betaling/); command(s, { ...input, type: 'refund', key: randomUUID(), version: r.version }); command(s, { action: 'reservation', id: r.id, version: r.version, operation: 'cancel' }); assert.equal(availability(s, r.itemId), 'available'); });
test('paid completion records purchased history and keeps stock sold', () => { const s = fixture(); reserve(s, payload(s)); const r = s.reservations[0]; command(s, { action: 'payment', id: r.id, version: r.version, key: randomUUID(), type: 'receipt', amountCents: 18500, date: new Date().toISOString(), note: '' }); command(s, { action: 'reservation', id: r.id, version: r.version, operation: 'complete' }); assert.equal(r.fulfilment, 'fulfilled'); assert.equal(availability(s, r.itemId), 'sold'); assert.throws(() => reserve(s, payload(s)), /gereserveerd of verkocht/); });
test('overdue review never releases stock and does not duplicate reminders', () => { const s = fixture(); reserve(s, payload(s)); s.reservations[0].deadline = new Date(0).toISOString(); reviewOverdue(s); reviewOverdue(s); assert.equal(availability(s, s.items[0].id), 'reserved'); assert.equal(s.emails.filter(m => m.kind === 'reminder').length, 1); });
test('public projections exclude customer and owner private records', () => { const s = fixture(); const result = reserve(s, payload(s)); const publicData = JSON.stringify(catalogue(s)); assert.ok(!publicData.includes('customer@example.com')); assert.ok(!publicData.includes(s.settings.iban)); assert.ok(!JSON.stringify(adminView(s)).includes('tokenHash')); assert.ok(!JSON.stringify(publicReservation(s.reservations[0])).includes(result.token!)); });
test('direct sales share stock exclusion and customer purchase history', () => { const s = fixture(); command(s, { action: 'save-customer', customer: { name: 'Direct Klant', email: 'direct@example.com', phone: '', channel: 'email', notes: '' } }); const input = { action: 'direct-sale', itemId: s.items[0].id, customerId: s.customers[0].id, key: randomUUID() }; command(s, input); command(s, input); assert.equal(s.reservations.length, 1); assert.equal(s.reservations[0].status, 'completed'); assert.equal(netPaid(s.reservations[0]), 18500); assert.throws(() => reserve(s, payload(s)), /gereserveerd of verkocht/); });
test('database persistence and rollback cover the entire reservation and outbox', () => { transact(s => Object.assign(s, fixture())); const input = transact(s => payload(s)); assert.throws(() => transact(s => { reserve(s, input); throw new Error('simulate crash'); }), /simulate crash/); assert.equal(transact(s => s.reservations.length), 0); assert.equal(transact(s => s.emails.length), 0); transact(s => reserve(s, input)); assert.equal(transact(s => s.reservations.length), 1); });
test('separate processes racing for one work produce exactly one committed reservation', async () => {
  transact(s => Object.assign(s, fixture()));
  const one = transact(s => payload(s, 'one@example.com')); const two = transact(s => payload(s, 'two@example.com'));
  const run = (input: unknown) => new Promise<number>(resolve => {
    const code = `import { transact } from './src/lib/backend/repository.ts'; import { reserve } from './src/lib/backend/service.ts'; try { transact(s => reserve(s, JSON.parse(process.env.TEST_RESERVATION))); process.exit(0); } catch { process.exit(2); }`;
    const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], { cwd: process.cwd(), env: { ...process.env, TEST_RESERVATION: JSON.stringify(input) }, stdio: 'ignore' }); child.on('exit', code => resolve(code || 0));
  });
  const results = await Promise.all([run(one), run(two)]); assert.deepEqual(results.sort(), [0, 2]); assert.equal(transact(s => s.reservations.length), 1); assert.equal(transact(s => s.emails.length), 2);
});
test('customer merge preserves purchases and notes without rewriting contact snapshots', () => { const s = fixture(); reserve(s, payload(s)); const source = s.customers[0]; source.notes = 'Oorspronkelijke notitie'; command(s, { action: 'save-customer', customer: { name: 'Doel Klant', email: 'target@example.com', phone: '', channel: 'email', notes: 'Bestaande notitie' } }); const target = s.customers[0]; command(s, { action: 'merge-customers', sourceId: source.id, targetId: target.id }); assert.equal(s.customers.length, 1); assert.equal(s.reservations[0].customerId, target.id); assert.equal(s.reservations[0].contact.email, 'customer@example.com'); assert.ok(target.notes.includes('Oorspronkelijke notitie')); assert.ok(target.notes.includes('Bestaande notitie')); });
test('owner correction updates only reservation contact and future email previews', () => { const s = fixture(); reserve(s, payload(s)); const r = s.reservations[0]; command(s, { action: 'correct-contact', id: r.id, version: r.version, contact: { ...r.contact, email: 'corrected@example.com' } }); command(s, { action: 'reservation', id: r.id, version: r.version, operation: 'resend' }); assert.equal(s.customers[0].email, 'customer@example.com'); assert.equal(s.emails[0].to, 'corrected@example.com'); assert.ok(s.emails.some(m => m.to === 'customer@example.com')); });
test('owner updates reject stale versions and preserve paid stock on cancellation failure', () => { const s = fixture(); reserve(s, payload(s)); const r = s.reservations[0]; assert.throws(() => command(s, { action: 'reservation', id: r.id, version: r.version - 1, operation: 'cancel' }), /gewijzigd/); assert.equal(availability(s, r.itemId), 'reserved'); assert.throws(() => command(s, { action: 'save-settings', settings: s.settings, version: 0 }), /gewijzigd/); });
test('overpayment remains visible and must be refunded before final completion', () => { const s = fixture(); reserve(s, payload(s)); const r = s.reservations[0]; const entry = { action: 'payment', id: r.id, version: r.version, key: randomUUID(), type: 'receipt', amountCents: 20000, date: new Date().toISOString(), note: '' }; command(s, entry); assert.throws(() => command(s, { action: 'reservation', id: r.id, version: r.version, operation: 'complete' }), /te veel ontvangen/); command(s, { ...entry, version: r.version, key: randomUUID(), type: 'refund', amountCents: 1500 }); command(s, { action: 'reservation', id: r.id, version: r.version, operation: 'complete' }); assert.ok(r.completedAt); assert.equal(netPaid(r), r.priceCents); });
test('owner sessions reject bad passwords, tampering, malformed signatures and foreign origins', async () => { const { NextRequest } = await import('next/server'); const { authenticate, isOwner, sameOrigin } = await import('./local-auth'); process.env.ADMIN_PASSWORD = 'isolated-test-password'; try { const token = authenticate('isolated-test-password'); const request = (cookie: string, origin = 'http://localhost:3000') => new NextRequest('http://localhost:3000/api/store', { headers: { cookie: `lothuus-owner=${cookie}`, origin } }); assert.equal(isOwner(request(token)), true); assert.equal(isOwner(request(token.slice(0,-1) + (token.endsWith('a') ? 'b' : 'a'))), false); assert.equal(isOwner(request('invalid.cookie.signature')), false); assert.throws(() => authenticate('incorrect'), /wachtwoord/); assert.throws(() => sameOrigin(request(token, 'https://untrusted.example')), /website/); } finally { delete process.env.ADMIN_PASSWORD; } });

test('incomplete numbered drafts persist without replacing the supplied catalogue', () => {
  const s = initialStore();
  const item = { creationKey: randomUUID(), materialGroup: 'K', editorReady: false, priceUnset: true, title: '', category: 'keramiek', description: '', priceCents: 0, date: '', material: '', dimensions: '', maker: '', condition: '', publication: 'draft', photos: [] };
  command(s, { action: 'save-item', item });
  assert.equal(s.items[0].productNumber, 'K1');
  assert.equal(s.items[0].priceUnset, true);
  assert.equal(catalogue(s).hasInventory, false);
  command(s, { action: 'save-item', item });
  assert.equal(s.items.length, 1);
  const first = s.items[0];
  command(s, { action: 'save-item', item: { ...first, publication: 'archived' } });
  command(s, { action: 'save-item', item: { ...item, creationKey: randomUUID() } });
  assert.equal(s.items[0].productNumber, 'K2');
  command(s, { action: 'save-item', item: { ...item, creationKey: randomUUID(), materialGroup: 'G', category: 'glas' } });
  assert.equal(s.items[0].productNumber, 'G1');
});
test('material codes remain fixed and readiness is validated on the server', () => {
  const s = fixture();
  command(s, { action: 'save-item', item: { ...s.items[0], materialGroup: 'K', publication: 'draft' } });
  const item = s.items[0];
  assert.equal(item.productNumber, 'K1');
  assert.throws(() => command(s, { action: 'save-item', item: { ...item, materialGroup: 'G' } }), /vast nummer/);
  assert.throws(() => command(s, { action: 'save-item', item: { ...item, editorReady: true } }), /ontbrekende/);
  assert.throws(() => command(s, { action: 'save-item', item: { ...item, version: 0 } }), /elders gewijzigd/);
  assert.equal(item.productNumber, 'K1');
});

test('material correction keeps the old code reserved and preserves product identity', () => {
  const s = fixture();
  command(s, { action: 'save-item', item: { ...s.items[0], materialGroup: 'K', publication: 'draft' } });
  const item = s.items[0]; const id = item.id;
  command(s, { action: 'change-material', id, version: item.version, materialGroup: 'G' });
  assert.equal(item.id, id);
  assert.equal(item.productNumber, 'G1');
  assert.deepEqual(item.previousNumbers, ['K1']);
  command(s, { action: 'change-material', id, version: item.version, materialGroup: 'K' });
  assert.equal(item.productNumber, 'K2');
  assert.deepEqual(item.previousNumbers, ['K1', 'G1']);
});
test('simultaneous draft creation and retries issue unique permanent product numbers', async () => {
  transact(s => Object.assign(s, initialStore(), { itemNumbers: {} }));
  const input = { action: 'save-item', item: { creationKey: randomUUID(), materialGroup: 'K', title: '', category: 'keramiek', description: '', priceCents: 0, priceUnset: true, date: '', material: '', dimensions: '', maker: '', condition: '', publication: 'draft', photos: [] } };
  const run = (payload: unknown) => new Promise<number>(resolve => {
    const code = `import { transact } from './src/lib/backend/repository.ts'; import { command } from './src/lib/backend/service.ts'; try { transact(s => command(s, JSON.parse(process.env.TEST_DRAFT))); process.exit(0); } catch { process.exit(2); }`;
    const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], { cwd: process.cwd(), env: { ...process.env, TEST_DRAFT: JSON.stringify(payload) }, stdio: 'ignore' }); child.on('exit', code => resolve(code || 0));
  });
  assert.deepEqual(await Promise.all([run(input), run(input), run({ ...input, item: { ...input.item, creationKey: randomUUID() } })]), [0, 0, 0]);
  assert.deepEqual(transact(s => s.items.map(i => i.productNumber).sort()), ['K1', 'K2']);
});

test('cart checkout creates one order and keeps every reserved object in the public grid', async () => {
  const { checkout } = await import('./service');
  const s = fixture();
  command(s, { action: 'save-item', item: { ...s.items[0], id: undefined, title: 'Tweede object', priceCents: 6500 } });
  const input = { items: s.items.map(i => ({ itemId: i.id, expectedPrice: i.priceCents, expectedVersion: i.version })), contact: payload(s).contact, message: '', termsVersion: s.settings.termsVersion, accepted: true, website: '', key: randomUUID() };
  const result = checkout(s, input);
  assert.equal(s.reservations.length, 1); assert.equal(result.lines.length, 2); assert.equal(result.priceCents, 25000);
  assert.equal(s.emails.length, 2); assert.equal(s.notifications?.length, 1);
  assert.deepEqual(checkout(s, input), result); assert.equal(s.notifications?.length, 1);
  const publicItems = catalogue(s).objects;
  assert.equal(publicItems.length, 2); assert.ok(publicItems.every(i => i.availability === 'reserved'));
  const r = s.reservations[0];
  command(s, { action: 'payment', id: r.id, version: r.version, key: randomUUID(), type: 'receipt', amountCents: 25000, date: new Date().toISOString(), note: '' });
  assert.ok(catalogue(s).objects.every(i => i.availability === 'sold')); assert.equal(r.status, 'active');
  assert.ok(s.emails[0].body.includes('Je betaling is bevestigd'));
  command(s, { action: 'reservation', id: r.id, version: r.version, operation: 'complete' });
  assert.equal(r.fulfilment, 'fulfilled');
});
test('cart conflicts are all-or-nothing and stale prices and duplicate lines are rejected', async () => {
  const { checkout } = await import('./service');
  const s = fixture();
  command(s, { action: 'save-item', item: { ...s.items[0], id: undefined, title: 'Tweede object' } });
  const input = { items: s.items.map(i => ({ itemId: i.id, expectedPrice: i.priceCents, expectedVersion: i.version })), contact: payload(s).contact, message: '', termsVersion: s.settings.termsVersion, accepted: true, website: '', key: randomUUID() };
  assert.throws(() => checkout(s, { ...input, items: [input.items[0], input.items[0]] }), /één keer/);
  assert.throws(() => checkout(s, { ...input, items: [input.items[0], { ...input.items[1], expectedPrice: 100 }] }), /gewijzigd/);
  assert.equal(s.reservations.length, 0); assert.equal(s.customers.length, 0);
  reserve(s, payload(s));
  assert.throws(() => checkout(s, input), /gereserveerd of verkocht/);
  assert.equal(s.reservations.length, 1); assert.equal(availability(s, input.items[1].itemId), 'available');
});
test('cart deadlines free unpaid stock, keep partial payments blocked and never reclaim stock for late payments', async () => {
  const { checkout } = await import('./service'); const { expireOrders } = await import('./types');
  const s = fixture();
  const makeInput = () => ({ items: s.items.map(i => ({ itemId: i.id, expectedPrice: i.priceCents, expectedVersion: i.version })), contact: payload(s).contact, message: '', termsVersion: s.settings.termsVersion, accepted: true, website: '', key: randomUUID() });
  checkout(s, makeInput()); const old = s.reservations[0]; old.deadline = new Date(0).toISOString();
  expireOrders(s); expireOrders(s); assert.equal(old.status, 'expired'); assert.equal(availability(s, old.itemId), 'available');
  assert.equal(s.notifications?.filter(n => n.id.startsWith('expired:')).length, 1);
  checkout(s, makeInput()); const next = s.reservations[0];
  command(s, { action: 'payment', id: old.id, version: old.version, key: randomUUID(), type: 'receipt', amountCents: 18500, date: new Date().toISOString(), note: 'Late overschrijving' });
  assert.equal(old.status, 'expired'); assert.equal(availability(s, old.itemId), 'reserved');
  assert.equal(s.emails.filter(m => m.reservationId === old.id && m.kind === 'receipt').length, 0);
  command(s, { action: 'payment', id: next.id, version: next.version, key: randomUUID(), type: 'receipt', amountCents: 1000, date: new Date().toISOString(), note: '' });
  next.deadline = new Date(0).toISOString(); expireOrders(s); assert.equal(next.status, 'active'); assert.equal(availability(s, next.itemId), 'reserved');
  assert.throws(() => command(s, { action: 'reservation', id: next.id, version: next.version, operation: 'cancel' }), /terugbetaling/);
});
test('notification read and resolved states are durable and absent from public data', async () => {
  const { checkout } = await import('./service'); const s = fixture(); const i = s.items[0];
  checkout(s, { items: [{ itemId: i.id, expectedPrice: i.priceCents, expectedVersion: i.version }], contact: payload(s).contact, message: '', termsVersion: s.settings.termsVersion, accepted: true, website: '', key: randomUUID() });
  const n = s.notifications![0]; command(s, { action: 'read-notification', id: n.id }); assert.equal(n.read, true); assert.equal(n.resolved, undefined);
  command(s, { action: 'resolve-notification', id: n.id }); assert.equal(n.resolved, true);
  assert.ok(!JSON.stringify(catalogue(s)).includes('Nieuwe bestelling van'));
});
test('payment deadlines keep Belgian local time across summer and winter time changes', async () => {
  const { paymentDeadline } = await import('./types');
  assert.equal(paymentDeadline(3, Date.parse('2026-03-27T11:30:00Z')), '2026-03-30T10:30:00.000Z');
  assert.equal(paymentDeadline(3, Date.parse('2026-10-23T10:30:00Z')), '2026-10-26T11:30:00.000Z');
});
test('cart orders racing across processes claim all lines once, and rollback covers the entire basket', async () => {
  const { checkout } = await import('./service');
  const s = fixture(); command(s, { action: 'save-item', item: { ...s.items[0], id: undefined, title: 'Tweede object' } });
  transact(state => Object.assign(state, s));
  const base = { items: s.items.map(i => ({ itemId: i.id, expectedPrice: i.priceCents, expectedVersion: i.version })), contact: payload(s).contact, message: '', termsVersion: '1', accepted: true, website: '', key: randomUUID() };
  assert.throws(() => transact(state => { checkout(state, base); throw new Error('rollback basket'); }), /rollback basket/);
  assert.equal(transact(state => state.reservations.length), 0); assert.equal(transact(state => state.notifications?.length), 0);
  const run = (input: unknown) => new Promise<number>(resolve => {
    const code = `import { transact } from './src/lib/backend/repository.ts'; import { checkout } from './src/lib/backend/service.ts'; try { transact(s => checkout(s, JSON.parse(process.env.TEST_RESERVATION))); process.exit(0); } catch { process.exit(2); }`;
    const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', code], { cwd: process.cwd(), env: { ...process.env, TEST_RESERVATION: JSON.stringify(input) }, stdio: 'ignore' }); child.on('exit', code => resolve(code || 0));
  });
  const results = await Promise.all([run(base), run({ ...base, key: randomUUID(), items: [...base.items].reverse(), contact: { ...base.contact, email: 'competitor@example.com' } })]);
  assert.deepEqual(results.sort(), [0, 2]);
  assert.equal(transact(state => state.reservations.length), 1); assert.equal(transact(state => state.emails.length), 2);
  assert.ok(transact(state => catalogue(state).objects.every(i => i.availability === 'reserved')));
});
test('private status polling does not exhaust the limit for creating a new cart order', async () => {
  const { checkout } = await import('./service');
  const { NextRequest } = await import('next/server');
  const { POST } = await import('../../app/api/reservations/route');
  const s = fixture(); command(s, { action: 'save-item', item: { ...s.items[0], id: undefined, title: 'Tweede object' } });
  transact(state => Object.assign(state, s));
  const first = transact(state => reserve(state, payload(state)));
  const request = (body: unknown) => new NextRequest('http://localhost:3000/api/reservations', { method: 'POST', headers: { origin: 'http://localhost:3000', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  for (let i = 0; i < 35; i++) assert.equal((await POST(request({ operation: 'status', token: first.token }))).status, 200);
  const available = s.items[1];
  const input = { items: [{ itemId: available.id, expectedPrice: available.priceCents, expectedVersion: available.version }], contact: payload(s).contact, message: '', termsVersion: '1', accepted: true, website: '', key: randomUUID() };
  const response = await POST(request(input)); assert.equal(response.status, 200);
  assert.equal(transact(state => state.reservations.length), 2);
  assert.ok(!JSON.stringify(await response.json()).includes('customer@example.com'));
});

test('real photo collection can be reserved with an email before prices, bank details or email sending are configured', async () => {
  const { checkout } = await import('./service'); const s = initialStore();
  const input = { items: [{ itemId: 'H031', expectedPrice: null, expectedVersion: 1 }], contact: { name: 'Aanvrager', email: 'CUSTOMER@example.com', phone: '', channel: 'email' }, message: '', termsVersion: '1', accepted: true, website: '', key: randomUUID() };
  assert.throws(() => checkout(s, { ...input, contact: { ...input.contact, email: '' } }));
  assert.equal(s.reservations.length, 0);
  const result = checkout(s, input); assert.equal(result.pricePending, true); assert.equal(result.paymentPending, true);
  assert.equal(s.reservations[0].contact.email, 'customer@example.com'); assert.equal(s.customers[0].email, 'customer@example.com');
  assert.equal(availability(s, 'H031'), 'reserved'); assert.equal(result.bank.iban, '');
  assert.ok(catalogue(s).objects.some(o => o.id === 'H031' && o.availability === 'reserved'));
  assert.ok(s.emails.every(e => e.status === 'preview' && !e.body.includes('€ 0,00')));
  assert.deepEqual(checkout(s, input), result); assert.equal(s.reservations.length, 1);
  assert.throws(() => checkout(s, { ...input, key: randomUUID() }), /gereserveerd of verkocht/);
  assert.throws(() => checkout(s, { ...input, key: randomUUID(), items: [{ itemId: 'H999', expectedPrice: null, expectedVersion: 1 }] }), /niet meer beschikbaar/);
});
test('unknown prices cannot be marked paid; owner prepares an actual bank agreement before payment and pickup', async () => {
  const { checkout } = await import('./service'); const s = initialStore();
  checkout(s, { items: [{ itemId: 'H031', expectedPrice: null, expectedVersion: 1 }, { itemId: 'K001', expectedPrice: null, expectedVersion: 1 }], contact: { name: 'Aanvrager', email: 'customer@example.com', phone: '', channel: 'email' }, message: '', termsVersion: '1', accepted: true, website: '', key: randomUUID() });
  const r = s.reservations[0];
  assert.throws(() => command(s, { action: 'payment', id: r.id, version: r.version, key: randomUUID(), type: 'receipt', amountCents: 100, date: new Date().toISOString(), note: '' }), /prijs en betaalafspraak/);
  assert.throws(() => command(s, { action: 'reservation', id: r.id, version: r.version, operation: 'complete' }), /prijs en volledige betaling/);
  assert.throws(() => command(s, { action: 'reservation', id: r.id, version: r.version, operation: 'pickup' }), /prijs en volledige betaling/);
  const prepare = () => ({ action: 'prepare-payment', id: r.id, version: r.version, prices: [{ itemId: 'H031', priceCents: 12500 }, { itemId: 'K001', priceCents: 4500 }] });
  assert.throws(() => command(s, prepare()), /rekeningnummer/); assert.equal(r.paymentPending, true);
  s.settings.iban = 'BE68539007547034'; s.settings.beneficiary = 'Test';
  assert.throws(() => command(s, { ...prepare(), prices: [{ itemId: 'H031', priceCents: 12500 }, { itemId: 'H031', priceCents: 4500 }] }), /elk object/);
  command(s, prepare()); assert.equal(r.priceCents, 17000); assert.equal(r.pricePending, false); assert.equal(r.paymentPending, false);
  assert.equal(publicReservation(r).bank.iban, 'BE68539007547034'); assert.ok(s.emails[0].body.includes('BE68539007547034'));
  assert.ok(s.emails.every(m => m.status === 'preview'));
  command(s, { action: 'payment', id: r.id, version: r.version, key: randomUUID(), type: 'receipt', amountCents: 17000, date: new Date().toISOString(), note: '' });
  assert.equal(availability(s, 'H031'), 'sold'); assert.equal(availability(s, 'K001'), 'sold');
  assert.ok(catalogue(s).objects.some(o => o.id === 'H031' && o.availability === 'sold'));
});
test('unconfigured bank details do not block reserving a priced object; explicit owner closure still blocks requests', async () => {
  const { checkout } = await import('./service'); const s = fixture(); s.settings.iban = ''; s.settings.reservationsEnabled = false;
  const i = s.items[0]; const input = { items: [{ itemId: i.id, expectedPrice: i.priceCents, expectedVersion: i.version }], contact: payload(s).contact, message: '', termsVersion: '1', accepted: true, website: '', key: randomUUID() };
  s.settings.requestsEnabled = false; assert.throws(() => checkout(s, input), /tijdelijk gesloten/);
  s.settings.requestsEnabled = true; const result = checkout(s, input);
  assert.equal(result.pricePending, false); assert.equal(result.paymentPending, true); assert.equal(result.priceCents, i.priceCents);
  assert.equal(availability(s, i.id), 'reserved');
});
test('reserving a mixed selection never partly claims source objects when another source is already reserved', async () => {
  const { checkout } = await import('./service'); const s = initialStore();
  const base = { items: [{ itemId: 'H031', expectedPrice: null, expectedVersion: 1 }], contact: { name: 'Aanvrager', email: 'customer@example.com', phone: '', channel: 'email' }, message: '', termsVersion: '1', accepted: true, website: '', key: randomUUID() };
  checkout(s, base);
  assert.throws(() => checkout(s, { ...base, key: randomUUID(), items: [{ itemId:'K001', expectedPrice:null, expectedVersion:1 }, ...base.items] }), /gereserveerd of verkocht/);
  assert.equal(availability(s, 'K001'), 'available'); assert.equal(s.reservations.length, 1);
  assert.equal(s.notifications?.length, 1); assert.equal(s.emails.length, 2);
  s.reservations[0].deadline = new Date(0).toISOString();
  const { expireOrders } = await import('./types'); expireOrders(s);
  assert.equal(availability(s,'H031'),'available');
  assert.equal(s.reservations[0].status,'expired');
});


test('photo order persists on an incomplete draft without changing its other fields', () => {
  const s = initialStore();
  const photos = [{ id: randomUUID(), alt: 'Eerste' }, { id: randomUUID(), alt: 'Tweede' }, { id: randomUUID(), alt: 'Derde' }];
  command(s, { action: 'save-item', item: { title: '', category: 'keramiek', description: '', priceCents: 0, priceUnset: true, date: '', material: '', dimensions: '', maker: '', condition: '', publication: 'draft', photos } });
  const before = structuredClone(s.items[0]);
  command(s, { action: 'save-item-photos', id: before.id, version: before.version, photos: [photos[2], photos[0], photos[1]] });
  const after = s.items[0];
  assert.deepEqual(after.photos.map(p => p.id), [photos[2].id, photos[0].id, photos[1].id]);
  assert.equal(after.version, before.version + 1);
  const { photos: ignoredPhotos, version: ignoredVersion, updatedAt: ignoredDate, ...unchanged } = after;
  const { photos: oldPhotos, version: oldVersion, updatedAt: oldDate, ...original } = before;
  assert.deepEqual(unchanged, original);
});

test('photo updates reject stale writers, duplicate photos and unknown items', () => {
  const s = fixture(), item = s.items[0];
  const request = { action: 'save-item-photos', id: item.id, version: item.version, photos: item.photos };
  command(s, request);
  assert.throws(() => command(s, request), /elders gewijzigd/);
  assert.throws(() => command(s, { ...request, version: item.version, photos: [item.photos[0], item.photos[0]] }), /één keer/);
  assert.throws(() => command(s, { ...request, id: randomUUID() }), /niet gevonden/);
  assert.throws(() => command(s, { ...request, version: item.version, photos: [] }), /minstens één foto/);
});

test('photo ordering is persisted across database reloads before completing a draft', () => {
  const otherPhotoId = randomUUID();
  writeFileSync(join(directory, 'images', `${otherPhotoId}-detail.webp`), 'test fixture');
  const created = transact(s => {
    command(s, { action: 'save-item', item: { title: '', materialGroup: 'K', category: 'keramiek', description: '', priceCents: 0, priceUnset: true, date: '', material: '', dimensions: '', maker: '', condition: '', publication: 'draft', photos: [{ id: photoId, alt: 'Eerste' }, { id: otherPhotoId, alt: 'Hoofdfoto' }] } });
    return structuredClone(s.items[0]);
  });
  transact(s => command(s, { action: 'save-item-photos', id: created.id, version: created.version, photos: [...created.photos].reverse() }));
  const reloaded = transact(s => s.items.find(item => item.id === created.id)!);
  assert.equal(reloaded.photos[0].id, otherPhotoId);
  assert.equal(reloaded.title, '');
  assert.equal(reloaded.description, '');
  assert.equal(reloaded.priceUnset, true);
  assert.equal(reloaded.publication, 'draft');
});
