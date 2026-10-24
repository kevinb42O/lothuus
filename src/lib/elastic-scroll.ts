/** Symmetrical outer-column lag, inspired by Codrops Elastic Grid Scroll demo 01. */
export function elasticProfile(column: number, columns: number, compact = false) {
  const mid = (columns - 1) / 2;
  const distance = mid ? Math.abs(column - mid) / mid : 0;
  return { time: .11 + distance * .17, limit: (compact ? 22 : 42) + distance * (compact ? 20 : 58) };
}

export function elasticStep(offset: number, scrollDelta: number, elapsed: number, time: number, limit: number) {
  const decay = Math.exp(-Math.max(0, elapsed) / time);
  const next = Math.max(-limit, Math.min(limit, (offset + scrollDelta) * decay));
  return Math.abs(next) < .05 ? 0 : next;
}
