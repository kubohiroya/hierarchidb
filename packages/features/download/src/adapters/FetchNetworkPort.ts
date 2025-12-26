import type { NetworkPort, ResponseLike } from '../ports.js';
import { resolveNetworkUrl } from '../helpers/resolveNetworkUrl.js';

export interface FetchNetworkPortOptions {
  headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>);
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  perHostConcurrency?: number; // simple semaphore per host
  globalConcurrency?: number;   // optional global semaphore across hosts
  rps?: number;                 // optional requests-per-second token bucket (global)
  corsProxyBaseURL?: string;
  authFetch?: (url: string, init?: RequestInit) => Promise<Response>;
}

type HostKey = string;

export class FetchNetworkPort implements NetworkPort {
  private opts: Required<Omit<FetchNetworkPortOptions, 'corsProxyBaseURL' | 'authFetch'>> & {
    corsProxyBaseURL: string;
    authFetch?: (url: string, init?: RequestInit) => Promise<Response>;
  };
  private semaphores = new Map<HostKey, Semaphore>();
  private globalSemaphore?: Semaphore;
  private tokenBucket?: TokenBucket;

  constructor(opts: FetchNetworkPortOptions = {}) {
    this.opts = {
      headers: opts.headers || {},
      retries: opts.retries ?? 3,
      baseDelayMs: opts.baseDelayMs ?? 300,
      maxDelayMs: opts.maxDelayMs ?? 5000,
      perHostConcurrency: opts.perHostConcurrency ?? 4,
      globalConcurrency: opts.globalConcurrency ?? 0,
      rps: opts.rps ?? 0,
      corsProxyBaseURL: opts.corsProxyBaseURL ?? '',
      authFetch: opts.authFetch,
    };
    if (this.opts.globalConcurrency > 0) this.globalSemaphore = new Semaphore(this.opts.globalConcurrency);
    if (this.opts.rps > 0) this.tokenBucket = new TokenBucket(this.opts.rps);
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
    if (this.tokenBucket) await this.tokenBucket.take();
    await Promise.all([
      sem.acquire(),
      this.globalSemaphore ? this.globalSemaphore.acquire() : Promise.resolve(),
    ]);
    try {
      const headers = await this.mergeHeaders(init?.headers);
      let attempt = 0;
      let lastErr: any;
      while (attempt <= this.opts.retries) {
        try {
          const target = resolveNetworkUrl(url, { corsProxyBaseURL: this.opts.corsProxyBaseURL });
          const fetcher = this.opts.authFetch ?? fetch;
          const res = await fetcher(target, { ...init, headers });
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
      if (this.globalSemaphore) this.globalSemaphore.release();
    }
  }

  private getSemaphore(host: string): Semaphore {
    let sem = this.semaphores.get(host);
    if (!sem) {
      sem = new Semaphore(this.opts.perHostConcurrency);
      this.semaphores.set(host, sem);
    }
    return sem;
  }

  private async resolveHeaders(): Promise<Record<string, string>> {
    const h = this.opts.headers;
    return typeof h === 'function' ? await h() : h;
  }

  private async mergeHeaders(extra?: HeadersInit): Promise<Headers> {
    const base = await this.resolveHeaders();
    const merged = new Headers(base);
    if (!extra) return merged;
    /*
    if (Array.isArray(extra)) {
      for (const [key, value] of extra) merged.set(key, value);
    } else */
    if (extra instanceof Headers) {
      extra.forEach((value, key) => merged.set(key, value));
    } else {
      Object.entries(extra as Record<string, string | number | readonly string[]>).forEach(([key, value]) => {
        if (Array.isArray(value)) merged.set(key, value.join(', '));
        else merged.set(key, String(value));
      });
    }
    return merged;
  }

  private shouldRetry(status: number): boolean {
    return status === 429 || (status >= 500 && status < 600);
  }
}

class Semaphore {
  private queue: Array<() => void> = [];
  private count: number;

  constructor(private capacity: number) {
    this.count = capacity;
  }

  acquire(): Promise<void> {
    if (this.count > 0) {
      this.count--;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }

  release(): void {
    if (this.queue.length > 0) {
      const resolve = this.queue.shift()!;
      resolve();
    } else this.count = Math.min(this.count + 1, this.capacity);
  }
}

class TokenBucket {
  private tokens: number;
  private queue: Array<() => void> = [];
  private lastRefill: number;

  constructor(private rps: number) {
    this.tokens = rps;
    this.lastRefill = Date.now();
    // Refill timer (best-effort)
    setInterval(() => this.refill(), 1000);
  }

  private refill() {
    const now = Date.now();
    if (now - this.lastRefill >= 1000) {
      this.tokens = this.rps;
      this.lastRefill = now;
      while (this.tokens > 0 && this.queue.length) {
        this.tokens--;
        const r = this.queue.shift()!;
        r();
      }
    }
  }

  take(): Promise<void> {
    this.refill();
    if (this.tokens > 0) {
      this.tokens--;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }
}

function wrap(r: Response): ResponseLike {
  return { ok: r.ok, status: r.status, headers: r.headers, arrayBuffer: () => r.arrayBuffer() };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function backoff(attempt: number, base: number, max: number): number {
  const exp = Math.min(max, base * 2 ** attempt);
  const jitter = Math.random() * base;
  return Math.min(max, exp + jitter);
}
