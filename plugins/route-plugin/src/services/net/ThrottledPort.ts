export interface NetworkPortLike {
  get(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>;
}

class Semaphore {
  private q: Array<() => void> = [];
  private c: number;

  constructor(private cap: number) {
    this.c = cap;
  }

  acquire(): Promise<void> {
    if (this.c > 0) {
      this.c--;
      return Promise.resolve();
    }
    return new Promise(r => this.q.push(r));
  }

  release(): void {
    const r = this.q.shift();
    if (r) r(); else this.c = Math.min(this.c + 1, this.cap);
  }
}

class TokenBucket {
  private tokens: number;
  private last: number;
  private waiters: Array<() => void> = [];

  constructor(private rps: number) {
    this.tokens = rps;
    this.last = Date.now();
    setInterval(() => this.refill(), 250);
  }

  private refill() {
    const now = Date.now();
    if (now - this.last >= 1000) {
      this.tokens = this.rps;
      this.last = now;
      while (this.tokens > 0 && this.waiters.length) {
        this.tokens--;
        const w = this.waiters.shift()!;
        w();
      }
    }
  }

  async take(): Promise<void> {
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
      return;
    }
    return new Promise(r => this.waiters.push(r));
  }
}

export interface ThrottleOptions {
  rps?: number;
  concurrency?: number;
}

export class ThrottledPort implements NetworkPortLike {
  private sem?: Semaphore;
  private bucket?: TokenBucket;

  constructor(private base: NetworkPortLike, opts: ThrottleOptions = {}) {
    if (opts.concurrency && opts.concurrency > 0) this.sem = new Semaphore(opts.concurrency);
    if (opts.rps && opts.rps > 0) this.bucket = new TokenBucket(opts.rps);
  }

  async get(url: string, init?: RequestInit) {
    if (this.bucket) await this.bucket.take();
    if (this.sem) await this.sem.acquire();
    try {
      return await this.base.get(url, init);
    } finally {
      if (this.sem) this.sem.release();
    }
  }
}
