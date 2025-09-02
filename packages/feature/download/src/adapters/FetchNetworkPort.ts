import type { NetworkPort, ResponseLike } from '../ports';

export interface FetchNetworkPortOptions {
  headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>);
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  perHostConcurrency?: number; // simple semaphore per host
}

type HostKey = string;

export class FetchNetworkPort implements NetworkPort {
  private opts: Required<FetchNetworkPortOptions>;
  private semaphores = new Map<HostKey, Semaphore>();

  constructor(opts: FetchNetworkPortOptions = {}) {
    this.opts = {
      headers: opts.headers || {},
      retries: opts.retries ?? 3,
      baseDelayMs: opts.baseDelayMs ?? 300,
      maxDelayMs: opts.maxDelayMs ?? 5000,
      perHostConcurrency: opts.perHostConcurrency ?? 4,
    };
  }

  async head(url: string, init?: RequestInit): Promise<ResponseLike> {
    return await this.request(url, { ...init, method: 'HEAD' });
  }

  async get(url: string, init?: RequestInit): Promise<ResponseLike> {
    return await this.request(url, { ...init, method: 'GET' });
  }

  async getRange(url: string, start: number, endInclusive: number, init?: RequestInit): Promise<ResponseLike> {
    const headers = new Headers(await this.resolveHeaders());
    headers.set('Range', `bytes=${start}-${endInclusive}`);
    return await this.request(url, { ...init, method: 'GET', headers });
  }

  private async request(url: string, init?: RequestInit): Promise<ResponseLike> {
    const host = new URL(url).host;
    const sem = this.getSemaphore(host);
    await sem.acquire();
    try {
      const headers = await this.mergeHeaders(init?.headers);
      let attempt = 0;
      let lastErr: any;
      while (attempt <= this.opts.retries) {
        try {
          const res = await fetch(url, { ...init, headers });
          if (res.ok) return wrap(res);
          if (!this.shouldRetry(res.status)) return wrap(res);
          await sleep(backoff(attempt++, this.opts.baseDelayMs, this.opts.maxDelayMs));
        } catch (e) {
          lastErr = e;
          await sleep(backoff(attempt++, this.opts.baseDelayMs, this.opts.maxDelayMs));
        }
      }
      if (lastErr) throw lastErr;
      throw new Error('Fetch failed');
    } finally {
      sem.release();
    }
  }

  private getSemaphore(host: string): Semaphore {
    let sem = this.semaphores.get(host);
    if (!sem) { sem = new Semaphore(this.opts.perHostConcurrency); this.semaphores.set(host, sem); }
    return sem;
  }

  private async resolveHeaders(): Promise<Record<string, string>> {
    const h = this.opts.headers;
    return typeof h === 'function' ? await h() : h;
  }

  private async mergeHeaders(extra?: HeadersInit): Promise<Headers> {
    const base = await this.resolveHeaders();
    const h = new Headers(base as any);
    if (extra) {
      if (Array.isArray(extra)) for (const [k, v] of extra) h.set(k, v as any);
      else if (extra instanceof Headers) (extra as Headers).forEach((v, k) => h.set(k, v));
      else Object.entries(extra).forEach(([k, v]) => h.set(k, v as any));
    }
    return h;
  }

  private shouldRetry(status: number): boolean {
    return status === 429 || (status >= 500 && status < 600);
  }
}

class Semaphore {
  private queue: Array<() => void> = [];
  private count: number;
  constructor(private capacity: number) { this.count = capacity; }
  acquire(): Promise<void> {
    if (this.count > 0) { this.count--; return Promise.resolve(); }
    return new Promise((resolve) => this.queue.push(resolve));
  }
  release(): void {
    if (this.queue.length > 0) { const resolve = this.queue.shift()!; resolve(); }
    else this.count = Math.min(this.count + 1, this.capacity);
  }
}

function wrap(r: Response): ResponseLike { return { ok: r.ok, status: r.status, headers: r.headers, arrayBuffer: () => r.arrayBuffer() }; }
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
function backoff(attempt: number, base: number, max: number): number {
  const exp = Math.min(max, base * Math.pow(2, attempt));
  const jitter = Math.random() * base;
  return Math.min(max, exp + jitter);
}

