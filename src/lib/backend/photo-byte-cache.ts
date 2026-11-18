/** Process-local bytes only. Callers MUST authorize every request before reading.
 * Photo IDs/variants are immutable; this never caches access decisions or HTTP responses.
 */
export class PhotoByteCache {
  private entries = new Map<string, { bytes: Uint8Array<ArrayBuffer>; expires: number }>();
  private pending = new Map<string, Promise<Uint8Array<ArrayBuffer> | null>>();
  private used = 0;
  constructor(private maximum = 16 * 1024 * 1024, private lifetime = 300_000, private clock = Date.now, private maximumEntries = 512) {}

  async read(key: string, load: () => Promise<Uint8Array<ArrayBuffer> | null>) {
    const now = this.clock();
    for (const [id, entry] of this.entries) {
      if (entry.expires <= now) this.remove(id);
    }
    const hit = this.entries.get(key);
    if (hit) {
      this.entries.delete(key); this.entries.set(key, hit);
      return hit.bytes;
    }
    const running = this.pending.get(key);
    if (running) return running;
    const task = Promise.resolve().then(load).then(bytes => {
      if (bytes && bytes.byteLength > 0 && bytes.byteLength <= this.maximum && this.maximumEntries > 0) {
        while (this.used + bytes.byteLength > this.maximum || this.entries.size >= this.maximumEntries) this.remove(this.entries.keys().next().value!);
        this.entries.set(key, { bytes, expires: this.clock() + this.lifetime });
        this.used += bytes.byteLength;
      }
      return bytes;
    }).finally(() => { this.pending.delete(key); });
    this.pending.set(key, task);
    return task;
  }

  private remove(key: string) {
    const entry = this.entries.get(key);
    if (entry) { this.used -= entry.bytes.byteLength; this.entries.delete(key); }
  }
}
