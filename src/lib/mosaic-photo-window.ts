export type PhotoBounds = { id: string; top: number; bottom: number; pixels: number; pinned?: boolean };

export function photoWindowPolicy(height: number, compact: boolean, saveData = false) {
  return {
    load: height * (saveData ? .5 : 1),
    retain: height * 2,
    // Estimates of decoded pixels, not a browser/process memory guarantee.
    pixels: (compact ? 16 : 48) * 1024 * 1024,
    count: compact ? 80 : 160,
  };
}

/** Separate entry/exit boundaries prevent churn when a row crosses the load edge. */
export function selectPhotoWindow(bounds: PhotoBounds[], previous: ReadonlySet<string>, height: number, policy: ReturnType<typeof photoWindowPolicy>) {
  const distance = (tile: PhotoBounds) => Math.max(0, tile.top - height, -tile.bottom);
  const intersects = (tile: PhotoBounds, margin: number) => tile.bottom > -margin && tile.top < height + margin;
  const candidates = bounds.filter(tile => tile.pinned || intersects(tile, policy.load) || previous.has(tile.id) && intersects(tile, policy.retain));
  candidates.sort((a, b) => Number(!!b.pinned || intersects(b, 0)) - Number(!!a.pinned || intersects(a, 0)) || distance(a) - distance(b));
  const next = new Set<string>();
  let pixels = 0;
  for (const tile of candidates) {
    const required = tile.pinned || intersects(tile, 0);
    if (!required && (next.size >= policy.count || pixels + tile.pixels > policy.pixels)) continue;
    next.add(tile.id);
    pixels += tile.pixels;
  }
  return next;
}
