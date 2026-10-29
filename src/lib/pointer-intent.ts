/** Require an uninterrupted two-second hover over the same object. */
export class PointerIntent {
  private target: string | null = null;
  private enteredAt = 0;
  tracking = false;

  reset() {
    this.target = null;
    this.enteredAt = 0;
    this.tracking = false;
  }

  move(id: string | null, now: number) {
    if (id === this.target) return false;
    this.target = id;
    this.enteredAt = now;
    this.tracking = id !== null;
    return true;
  }

  finish(now: number): string | null {
    if (!this.tracking || now - this.enteredAt < 2000) return null;
    this.tracking = false;
    return this.target;
  }
}
