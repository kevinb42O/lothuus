export type PointerSample = { x: number; y: number; time: number };
export type IntentTarget = { id: string; left: number; top: number; right: number; bottom: number };

function contains(target: IntentTarget, point: PointerSample, inset = 0) {
  return point.x >= target.left + inset && point.x <= target.right - inset &&
    point.y >= target.top + inset && point.y <= target.bottom - inset;
}

/** A journey owns its geometry. Repacking cannot nominate a different destination. */
export class PointerIntent {
  private targets: IntentTarget[] = [];
  private previous: PointerSample | null = null;
  private speeds: number[] = [];
  private peak = 0;
  private candidate: string | null = null;
  private distanceInTarget = 0;
  private cadence = 16;
  private lastInput = 0;
  tracking = false;

  reset() {
    this.targets = []; this.previous = null; this.speeds = []; this.peak = 0;
    this.candidate = null; this.distanceInTarget = 0; this.cadence = 16; this.lastInput = 0; this.tracking = false;
  }

  move(point: PointerSample, snapshot: () => IntentTarget[]): string | null {
    const previous = this.previous;
    const distance = previous ? Math.hypot(point.x - previous.x, point.y - previous.y) : 0;
    if (this.tracking && distance > .05) this.lastInput = point.time;
    // Ignore subpixel sensor noise, including after a landing. It must not start a new journey.
    if (previous && distance < 1.5) return null;
    // Repacking can put a neighbor beneath the landing point. A tiny correction is
    // still part of that landing, not permission to open the newly arriving tile.
    if (!this.tracking && previous && distance < 8) return null;
    if (!this.tracking) {
      this.targets = snapshot(); this.speeds = []; this.peak = 0;
      this.candidate = null; this.distanceInTarget = 0; this.cadence = 16;
      this.previous = point; this.tracking = true;
      this.lastInput = point.time;
      return null;
    }
    const elapsed = Math.max(1, point.time - previous!.time);
    this.cadence = this.cadence * .65 + Math.min(40, elapsed) * .35;
    const speed = distance / elapsed;
    this.speeds.push(speed);
    if (this.speeds.length > 3) this.speeds.shift();
    const average = this.speeds.reduce((sum, value) => sum + value, 0) / this.speeds.length;
    this.peak = Math.max(this.peak, average);
    this.previous = point;
    const target = this.targets.find(target => contains(target, point));
    if (target?.id !== this.candidate) {
      this.candidate = target?.id ?? null; this.distanceInTarget = 0;
    } else this.distanceInTarget += distance;
    if (!target || this.speeds.length < 3 || this.distanceInTarget < 10) return null;

    // Braking inside a destination, with the projected endpoint still inside it.
    // A slow but continuous sweep never qualifies solely because it is slow.
    const inset = Math.min(12, (target.right - target.left) * .1, (target.bottom - target.top) * .1);
    const projected = { ...point, x: point.x + (point.x - previous!.x) / elapsed * 48, y: point.y + (point.y - previous!.y) / elapsed * 48 };
    if (this.peak >= .35 && average <= .22 && average < this.peak * .38 &&
      contains(target, point, inset) && contains(target, projected, inset)) {
      this.tracking = false;
      return target.id;
    }
    return null;
  }

  /** Detect the end of pointer input, not time spent hovering a particular tile. */
  finish(now: number): string | null {
    if (!this.tracking || !this.previous || now - this.lastInput < Math.max(34, this.cadence * 2.5)) return null;
    this.tracking = false;
    // Resolve even a single-event arrival, but keep ambiguous tile edges neutral.
    return this.targets.find(target => contains(target, this.previous!, 3))?.id ?? null;
  }

  get point() { return this.previous; }
}
