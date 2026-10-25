import { createHmac, randomBytes } from 'node:crypto';
const salt = randomBytes(32);
const buckets = new Map<string, { minute: number; count: number }>();
let minute = -1, total = 0, blockedUntil = 0;
export function ingestAllowed(address: string, now = Date.now()) {
  if (now < blockedUntil) return false;
  const window = Math.floor(now / 60000);
  if (minute !== window) { minute = window; total = 0; buckets.clear(); }
  const key = createHmac('sha256', salt).update(address).digest('hex');
  const bucket = buckets.get(key) || { minute: window, count: 0 };
  if (bucket.count >= 60 || total >= 120 || buckets.size >= 1000 && !buckets.has(key)) return false;
  bucket.count++; total++; buckets.set(key, bucket); return true;
}
export function closeIngestUntil(reset: string) {
  const at = Date.parse(reset);
  if (Number.isFinite(at)) blockedUntil = Math.max(blockedUntil, Math.min(at, Date.now() + 86400000));
}
