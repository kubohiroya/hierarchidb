import type { NetworkPort, ResponseLike } from '../ports.js';
import { resolveNetworkUrl } from '../helpers/resolveNetworkUrl.js';
import { smartFetch } from '../smartFetch.js';

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
  auth?: {
    enabled?: boolean;
    /** 推奨: 認証/通知のルーティングに使うスコープ（例: 'shape' | 'location' | 'route'）。 */
    scope?: string;
    sessionId?: string;
    maxRetries?: number;
  };
}

type HostKey = string;

const createAbortError = (): Error => {
  if (typeof DOMException === 'function') {
    return new DOMException('Fetch aborted', 'AbortError');
  }
  const error = new Error('Fetch aborted');
  (error as Error & { name: string }).name = 'AbortError';
  return error;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const wrap = (res: Response): ResponseLike => ({
  status: res.status,
  ok: res.ok,
  headers: res.headers,
  arrayBuffer: () => res.arrayBuffer(),
});

class Semaphore {
  private available: number;
  private readonly queue: Array<() => void> = [];

  constructor(capacity: number) {
    this.available = Math.max(1, capacity);
  }

  async acquire(): Promise<void> {
    if (this.available > 0) {
      this.available -= 1;
      return;
    }
    await new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.available -= 1;
        resolve();
      });
    });
  }

  release(): void {
    this.available += 1;
    const next = this.queue.shift();
    if (next) next();
  }
}

class TokenBucket {
  private tokens: number;
  private lastRefill = Date.now();

  constructor(private readonly rps: number) {
    this.tokens = rps;
  }

  async take(): Promise<void> {
    while (true) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      await sleep(50);
    }
  }

  private refill(): void {
    const now = Date.now();
    const elapsedMs = now - this.lastRefill;
    if (elapsedMs <= 0) return;
    const refillTokens = (elapsedMs / 1000) * this.rps;
    if (refillTokens >= 1) {
      this.tokens = Math.min(this.rps, this.tokens + refillTokens);
      this.lastRefill = now;
    }
  }
}

export class FetchNetworkPort implements NetworkPort {
  private opts: Required<Omit<FetchNetworkPortOptions, 'corsProxyBaseURL' | 'authFetch'>> & {
    corsProxyBaseURL: string;
    authFetch?: (url: string, init?: RequestInit) => Promise<Response>;
    auth: { enabled: boolean; scope: string; sessionId?: string; maxRetries?: number };
  };
  private semaphores = new Map<HostKey, Semaphore>();
  private globalSemaphore?: Semaphore;
  private tokenBucket?: TokenBucket;

  constructor(opts: FetchNetworkPortOptions = {}) {
    const authEnabled = opts.auth?.enabled ?? true;
    const scopeProvided = typeof opts.auth?.scope === 'string' && opts.auth.scope.length > 0;
    if (authEnabled && !scopeProvided && !opts.authFetch) {
      throw new Error('[download][FetchNetworkPort] auth.scope is required when auth is enabled');
    }

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
      auth: {
        enabled: opts.auth?.enabled ?? true,
        scope: (opts.auth?.scope ?? ''),
        sessionId: opts.auth?.sessionId,
        maxRetries: opts.auth?.maxRetries,
      },
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
    if (init?.signal?.aborted) {
      throw createAbortError();
    }
    const host = new URL(url).host;
    const sem = this.getSemaphore(host);
    if (this.tokenBucket) await this.tokenBucket.take();
    await Promise.all([
      sem.acquire(),
      this.globalSemaphore ? this.globalSemaphore.acquire() : Promise.resolve(),
    ]);

    try {
      const headers = await this.mergeHeaders(init?.headers);
      // Backward compat: if caller injects authFetch, keep using it.
      // (authFetch側にretryが無いケースもあるが、破壊的変更を避けるためここは維持)
      if (this.opts.authFetch) {
        const res = await this.opts.authFetch(
          resolveNetworkUrl(url, { corsProxyBaseURL: this.opts.corsProxyBaseURL }),
          { ...init, headers },
        );
        return wrap(res);
      }

      const res = await smartFetch(url, {
        request: { ...init, headers },
        corsProxy: { baseURL: this.opts.corsProxyBaseURL || undefined },
        auth: {
          enabled: this.opts.auth.enabled,
          scope: this.opts.auth.scope,
          sessionId: this.opts.auth.sessionId,
          maxRetries: this.opts.auth.maxRetries,
        },
        retry: {
          enabled: this.opts.retries > 0,
          retries: this.opts.retries,
          baseDelayMs: this.opts.baseDelayMs,
          maxDelayMs: this.opts.maxDelayMs,
          shouldRetry: (r) => this.shouldRetry(r.status),
        },
      });

      return wrap(res);
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

  private async mergeHeaders(initHeaders: HeadersInit | undefined): Promise<Headers> {
    const base = await this.resolveHeaders();
    const headers = new Headers(base);
    if (initHeaders) {
      const incoming = new Headers(initHeaders);
      incoming.forEach((value, key) => headers.set(key, value));
    }
    return headers;
  }

  private shouldRetry(status: number): boolean {
    return status === 408 || status === 429 || (status >= 500 && status <= 599);
  }
}

