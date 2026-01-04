import type { AuthContext, AuthScope } from '@hierarchidb/auth-recovery';
import { AuthService } from '@hierarchidb/auth-recovery';
import { resolveNetworkUrl } from './helpers/resolveNetworkUrl.js';

export type SmartFetchAuthOptions = {
  enabled?: boolean;
  /** 推奨: 認証/通知のルーティングに使うスコープ（例: 'shape' | 'location' | 'route'）。 */
  scope?: string;
  sessionId?: string;
  maxRetries?: number;
};

export type SmartFetchRetryOptions = {
  enabled?: boolean;
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryOnStatuses?: number[];
  /** true を返したときにリトライする。指定があればretryOnStatusesより優先 */
  shouldRetry?: (res: Response) => boolean;
};

export type SmartFetchCorsProxyOptions = {
  baseURL?: string;
};

export type SmartFetchTimeoutOptions = {
  timeoutMs?: number;
};

export type SmartFetchOptions = {
  request?: RequestInit;
  auth?: SmartFetchAuthOptions;
  retry?: SmartFetchRetryOptions;
  corsProxy?: SmartFetchCorsProxyOptions;
  timeout?: SmartFetchTimeoutOptions;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const backoff = (attempt: number, baseDelayMs: number, maxDelayMs: number): number => {
  const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
  const jitter = Math.random() * 0.25 * delay;
  return Math.round(delay + jitter);
};

const shouldRetryStatus = (status: number, retryOnStatuses: number[]) => retryOnStatuses.includes(status);

/**
 * smartFetch
 *
 * - fetch互換の入口を維持しつつ、階層化されたoptionsで auth/retry/timeout/corsProxy を合成
 * - 認証は AuthService.fetchWithAuth に一本化
 * - URL解決（CORS proxy）は resolveNetworkUrl に一本化
 */
export async function smartFetch(input: string, options: SmartFetchOptions = {}): Promise<Response> {
  const request = options.request ?? {};

  // timeout handling (AbortController)
  const timeoutMs = options.timeout?.timeoutMs;
  const outerSignal = request.signal;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const signal = controller ? controller.signal : outerSignal;
  if (controller && outerSignal) {
    if (outerSignal.aborted) controller.abort();
    else outerSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  if (controller && typeof timeoutMs === 'number' && timeoutMs > 0) {
    timeout = setTimeout(() => controller.abort(), timeoutMs);
  }

  const target = resolveNetworkUrl(input, { corsProxyBaseURL: options.corsProxy?.baseURL });

  const authEnabled = options.auth?.enabled ?? true;
  const scope = options.auth?.scope;
  if (authEnabled && (!scope || scope.length === 0)) {
    throw new Error('[download][smartFetch] auth.scope is required when auth is enabled');
  }
  const pluginType = (scope ?? 'generic') as AuthScope;

  const ctx: AuthContext = {
    scope: pluginType,
    sessionId: options.auth?.sessionId,
    maxRetries: options.auth?.maxRetries,
  };

  const retries = options.retry?.enabled === false ? 0 : (options.retry?.retries ?? 0);
  const baseDelayMs = options.retry?.baseDelayMs ?? 250;
  const maxDelayMs = options.retry?.maxDelayMs ?? 2500;
  const retryOnStatuses = options.retry?.retryOnStatuses ?? [408, 429, 500, 502, 503, 504];
  const shouldRetry = options.retry?.shouldRetry;

  try {
    let attempt = 0;
    while (true) {
      try {
        const init: RequestInit = { ...request, signal };
        const res = authEnabled
          ? await (await AuthService.getSingleton()).fetchWithAuth(target, init, ctx)
          : await fetch(target, init);

        const needRetry = shouldRetry
          ? shouldRetry(res)
          : shouldRetryStatus(res.status, retryOnStatuses);

        if (retries > 0 && needRetry && attempt < retries) {
          await sleep(backoff(attempt++, baseDelayMs, maxDelayMs));
          continue;
        }
        return res;
      } catch (e) {
        if (attempt < retries) {
          await sleep(backoff(attempt++, baseDelayMs, maxDelayMs));
          continue;
        }
        throw e;
      }
    }
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
