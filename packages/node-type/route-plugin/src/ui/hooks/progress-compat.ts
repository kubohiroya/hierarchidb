export type ProgressSnapshot = { jobId: string; progress: number; phase: string; ts: number };

export interface ProgressSnapshotStore {
  upsert(jobId: string, snap: ProgressSnapshot): Promise<void>;
  get(jobId: string): Promise<ProgressSnapshot | undefined>;
}

export class ProgressEmitter {
  private last = 0;
  private queued?: ProgressSnapshot;
  private timer?: any;
  private listeners: Array<(s: ProgressSnapshot) => void> = [];
  constructor(private hz = 10) {}
  on(fn: (s: ProgressSnapshot) => void) { this.listeners.push(fn); return () => this.off(fn); }
  off(fn: (s: ProgressSnapshot) => void) { this.listeners = this.listeners.filter(f => f !== fn); }
  emit(s: ProgressSnapshot) {
    const minDelta = 1000 / this.hz;
    const now = Date.now();
    if (now - this.last >= minDelta) {
      this.flush(s);
    } else {
      this.queued = s;
      if (!this.timer) this.timer = setTimeout(() => this.flushQueued(), minDelta);
    }
  }
  private flushQueued() { if (this.queued) this.flush(this.queued); this.queued = undefined; clearTimeout(this.timer); this.timer = undefined; }
  private flush(s: ProgressSnapshot) { this.last = Date.now(); for (const fn of this.listeners) fn(s); }
}

