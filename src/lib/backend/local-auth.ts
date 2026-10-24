import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { NextRequest } from 'next/server';
import { dataDirectory, transact } from './repository';
import { BusinessError, hash, limit } from './service';
export const sessionCookie = 'lothuus-owner';
function credentials(): { hash: string; salt: string; secret: string } | null {
  const path = join(dataDirectory(), 'owner.json');
  if (process.env.ADMIN_PASSWORD) {
    mkdirSync(dataDirectory(), { recursive: true, mode: 0o700 });
    const keyPath = join(dataDirectory(), 'session-key');
    if (!existsSync(keyPath)) { try { writeFileSync(keyPath, randomBytes(32).toString('hex'), { mode: 0o600, flag: 'wx' }); } catch (e) { if (!existsSync(keyPath)) throw e; } }
    const secret = readFileSync(keyPath, 'utf8'); const salt = secret.slice(0, 32);
    return { hash: scryptSync(process.env.ADMIN_PASSWORD, salt, 64).toString('hex'), salt, secret };
  }
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}
export function configured() { return credentials() !== null; }
export function authenticate(password: string) {
  const record = credentials(); if (!record) throw new BusinessError('Stel eerst je eigenaarswachtwoord in met npm run owner:setup.', 503);
  const attempt = scryptSync(password, record.salt, 64); const actual = Buffer.from(record.hash, 'hex');
  if (attempt.length !== actual.length || !timingSafeEqual(attempt, actual)) throw new BusinessError('Het wachtwoord klopt niet.', 401);
  const payload = `${Date.now() + 8 * 3600000}.${randomBytes(16).toString('hex')}`;
  return `${payload}.${createHmac('sha256', record.secret).update(payload).digest('hex')}`;
}
export function isOwner(request: NextRequest) {
  const record = credentials(); const value = request.cookies.get(sessionCookie)?.value;
  if (!record || !value) return false;
  const parts = value.split('.'); if (parts.length !== 3 || !/^\d+$/.test(parts[0]) || !/^[a-f0-9]{32}$/.test(parts[1]) || !/^[a-f0-9]{64}$/.test(parts[2]) || Number(parts[0]) < Date.now()) return false;
  const signature = createHmac('sha256', record.secret).update(`${parts[0]}.${parts[1]}`).digest('hex');
  return parts[2].length === signature.length && timingSafeEqual(Buffer.from(parts[2]), Buffer.from(signature));
}
export function requireOwner(request: NextRequest) { if (!isOwner(request)) throw new BusinessError('Log opnieuw in om verder te gaan.', 401); }
export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  const expected = process.env.APP_ORIGIN || `${request.nextUrl.protocol}//${request.headers.get('host') || request.nextUrl.host}`;
  if (!origin || origin !== expected) throw new BusinessError('Deze aanvraag komt niet van de website.', 403);
}
export function throttle(request: NextRequest, prefix: string, max: number) {
  // Proxy IPs are trusted only when the operator explicitly configures a proxy.
  const ip = process.env.TRUST_PROXY === 'true' ? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown' : 'local';
  transact(s => limit(s, `${prefix}:${hash(ip)}`, max, 15 * 60000));
}
export async function readJson(request: NextRequest) {
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 128000) throw new BusinessError('De aanvraag is te groot.', 413);
  try { const value = JSON.parse(raw); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value; } catch { throw new BusinessError('De aanvraag bevat geen geldige gegevens.'); }
}
