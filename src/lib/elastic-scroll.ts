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

/** Progressive resistance: a longer pull adds less travel, bounded by the viewport. */
export function edgeRubberband(pull: number, limit: number) {
  return limit * .7 * Math.max(0, pull) / (limit + .7 * Math.max(0, pull));
}

/** Critically damped return: one continuous approach to rest, without oscillation. */
export function edgeSpringStep(position: number, velocity: number, elapsed: number, target = 0) {
  const frequency = 36;
  const distance = position - target;
  const time = Math.max(0, elapsed);
  const decay = Math.exp(-frequency * time);
  const coefficient = velocity + frequency * distance;
  const next = Math.max(0, target + decay * (distance + coefficient * time));
  const speed = decay * (velocity - frequency * coefficient * time);
  return next === 0 && speed < 0 || Math.abs(next - target) < .05 && Math.abs(speed) < .5
    ? { position: target, velocity: 0 }
    : { position: next, velocity: speed };
}
