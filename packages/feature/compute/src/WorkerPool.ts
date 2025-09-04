const randomUUIDCompat = (): string => {
  const g: any = typeof globalThis !== 'undefined' ? (globalThis as any) : {};
  if (g.crypto && typeof g.crypto.randomUUID === 'function') {
    return g.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
import type { ClockPort } from './ports';
import type { TaskHandle, TaskSpec, TaskStatus } from './types';

export interface WorkerPoolOptions {
  concurrency: number;
  clock?: ClockPort;
}

export class WorkerPool {
  private queue: Array<{ spec: TaskSpec; resolve: (v: any) => void; reject: (e: any) => void; handle: InternalHandle<any> }>
    = [];
  private running = 0;
  private readonly max: number;
  private readonly clock: ClockPort;

  constructor(opts: WorkerPoolOptions) {
    this.max = Math.max(1, opts.concurrency);
    this.clock = opts.clock || defaultClock;
  }

  submit<I = any, O = any>(spec: TaskSpec<I, O>): TaskHandle<O> {
    const id = spec.id || randomUUIDCompat();
    const handle = new InternalHandle<O>(id);
    const p = new Promise<O>((resolve, reject) => {
      this.queue.push({ spec: { ...spec, id }, resolve, reject, handle });
      handle.setStatus('queued');
      this.drain();
    });
    handle.attachResult(p);
    return handle;
  }

  private drain(): void {
    while (this.running < this.max && this.queue.length > 0) {
      const item = this.queue.shift()!;
      this.running++;
      item.handle.setStatus('running');
      // Minimal in-thread executor: prefer spec.fn, otherwise echo input
      const controller = new AbortController();
      item.handle.attachAbort(controller);
      const report = (p: number) => item.handle.emitProgress(p);
      const work = async () => {
        try {
          const fn = item.spec.fn || (async (i: any) => i);
          const out = await fn(item.spec.input, controller.signal, report);
          item.handle.setStatus('completed');
          item.resolve(out);
        } catch (e) {
          if ((e as any)?.name === 'AbortError') {
            item.handle.setStatus('cancelled');
            item.reject(e);
          } else {
            item.handle.setStatus('failed');
            item.reject(e);
          }
        } finally {
          this.running--;
          this.clock.setTimeout(() => this.drain(), 0);
        }
      };
      this.clock.setTimeout(work, 0);
    }
  }
}

class InternalHandle<O> implements TaskHandle<O> {
  private _status: TaskStatus = 'queued';
  private progressListeners = new Set<(p: number) => void>();
  private statusListeners = new Set<(s: TaskStatus) => void>();
  private resultPromise!: Promise<O>;
  private controller?: AbortController;

  constructor(public readonly id: string) {}

  attachResult(p: Promise<O>) { this.resultPromise = p; }
  attachAbort(c: AbortController) { this.controller = c; }
  emitProgress(p: number) { this.progressListeners.forEach((f) => f(p)); }
  setStatus(s: TaskStatus) { this._status = s; this.statusListeners.forEach((f) => f(s)); }

  status(): TaskStatus { return this._status; }
  cancel(): void { this.controller?.abort(new DOMException('Aborted', 'AbortError')); }
  onProgress(cb: (p: number) => void): () => void { this.progressListeners.add(cb); return () => this.progressListeners.delete(cb); }
  onStatus(cb: (s: TaskStatus) => void): () => void { this.statusListeners.add(cb); return () => this.statusListeners.delete(cb); }
  result(): Promise<O> { return this.resultPromise; }
}

const defaultClock: ClockPort = {
  now: () => Date.now(),
  setTimeout: (cb, ms) => setTimeout(cb, ms),
  clearTimeout: (id) => clearTimeout(id as any),
};
