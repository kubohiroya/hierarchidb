/**
 * Timeline Plugin - Services entry (placeholder)
 * Exposes minimal surface for app registry consistency.
 */

export type TimelineFrame = { id: string; t: number; payload?: Record<string, unknown> };

export class TimelineFramesService {
  private frames: TimelineFrame[] = [];

  addFrame(t: number, payload?: Record<string, unknown>): TimelineFrame {
    const f: TimelineFrame = { id: crypto.randomUUID(), t, payload };
    this.frames.push(f);
    this.frames.sort((a, b) => a.t - b.t);
    return f;
  }

  getFrames(): TimelineFrame[] { return [...this.frames]; }

  clear(): void { this.frames = []; }

  /** Return indices [i0, i1] for frames bracketing time t */
  bracket(t: number): [number, number] | null {
    if (this.frames.length === 0) return null;
    const i1 = this.frames.findIndex((f) => f.t >= t);
    if (i1 < 0) return [this.frames.length - 1, this.frames.length - 1];
    if (i1 === 0) return [0, 0];
    return [i1 - 1, i1];
  }
}

export const timelineServices = { TimelineFramesService };
