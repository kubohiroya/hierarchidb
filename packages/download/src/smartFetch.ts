import type { AuthContext, AuthScope } from '@hierarchidb/auth-api';
import { AuthService } from '@hierarchidb/auth';
import { resolveNetworkUrl } from './helpers/resolveNetworkUrl.js';
import { sleep } from '@hierarchidb/util';

export type SmartFetchAuthOptions = {
  enabled?: boolean;
  /** 推奨: 認証/通知のルーティングに使うスコープ（例: 'shape' | 'location' | 'route'）。 */
  scope?: string;
  sessionId?: string;
  /** Epoch ms when the build session started. Used to distinguish build attempts for auth dedup. */
  sessionStartedAt?: number;
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

export type SmartFetchInFlightOptions = {
  enabled?: boolean;
  keyBuilder?: (context: {
    method: string;
    resolvedUrl: string;
    accept: string;
    auth: { enabled: boolean; scope?: string; sessionId?: string };
  }) => string | null;
};

export type SmartFetchOptions = {
  request?: RequestInit;
  auth?: SmartFetchAuthOptions;
  retry?: SmartFetchRetryOptions;
  corsProxy?: SmartFetchCorsProxyOptions;
  timeout?: SmartFetchTimeoutOptions;
  inFlight?: SmartFetchInFlightOptions;
  onDownloadProgress?: (progress: {
    loadedBytes: number;
    totalBytes?: number;
    percentage?: number;
  }) => void | Promise<void>;
};

const backoff = (attempt: number, baseDelayMs: number, maxDelayMs: number): number => {
  const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
  const jitter = Math.random() * 0.25 * delay;
  return Math.round(delay + jitter);
};

const shouldRetryStatus = (status: number, retryOnStatuses: number[]) => retryOnStatuses.includes(status);
type InFlightEntry = { authKey: string; promise: Promise<Response> };
const inFlightMap = new Map<string, InFlightEntry[]>();
const inFlightGetAccept = (request?: RequestInit): string => {
  if (!request?.headers) return '';
  const headers = new Headers(request.headers);
  return headers.get('accept') ?? '';
};
const inFlightKeyDefault = (method: string, resolvedUrl: string, accept: string): string => (
  `${method}:${resolvedUrl}:${accept}`
);
const isInFlightMethod = (method: string): boolean => (
  method === 'GET' || method === 'HEAD'
);
const shouldShareInFlight = (opts: SmartFetchOptions): boolean => (
  opts.inFlight?.enabled === true
);
const buildAuthKey = (auth: { enabled: boolean; scope?: string; sessionId?: string }): string => (
  `${auth.enabled ? '1' : '0'}:${auth.scope ?? ''}:${auth.sessionId ?? ''}`
);
const resolveInFlightKey = (
  opts: SmartFetchOptions,
  method: string,
  resolvedUrl: string,
  accept: string,
  auth: { enabled: boolean; scope?: string; sessionId?: string },
): string | null => {
  const builder = opts.inFlight?.keyBuilder;
  if (builder) {
    return builder({ method, resolvedUrl, accept, auth });
  }
  return inFlightKeyDefault(method, resolvedUrl, accept);
};
const getInFlightEntry = (key: string, authKey: string): InFlightEntry | undefined => {
  const entries = inFlightMap.get(key);
  if (!entries) return undefined;
  return entries.find((entry) => entry.authKey === authKey);
};
const registerInFlight = (key: string, authKey: string, promise: Promise<Response>): void => {
  const entry: InFlightEntry = { authKey, promise };
  const entries = inFlightMap.get(key) ?? [];
  entries.push(entry);
  inFlightMap.set(key, entries);
  void promise.finally(() => {
    const current = inFlightMap.get(key);
    if (!current) return;
    const next = current.filter((item) => item !== entry);
    if (next.length === 0) {
      inFlightMap.delete(key);
    } else {
      inFlightMap.set(key, next);
    }
  }).catch(() => { });
};

/**
 * smartFetch
 *
 * - fetch互換の入口を維持しつつ、階層化されたoptionsで auth/retry/timeout/corsProxy を合成
 * - 認証は AuthService.fetchWithAuth に一本化
 * - URL解決（CORS proxy）は resolveNetworkUrl に一本化
 */
export async function smartFetch(input: string, options: SmartFetchOptions = {}): Promise<Response> {
  const request = options.request ?? {};
  const method = (request.method ?? 'GET').toUpperCase();

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

  // Debug logging for authentication state evaluation
  const isAuthDebugEnabled = (): boolean => {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem('hidb_auth_debug') === '1';
    } catch {
      return false;
    }
  };

  if (isAuthDebugEnabled()) {
    console.debug('[download][smartFetch] authentication state evaluation', {
      input,
      target,
      authEnabled,
      scope,
      pluginType,
      sessionId: options.auth?.sessionId,
      method,
      isCorsProxy: target !== input,
    });
  }

  const ctx: AuthContext = {
    scope: pluginType,
    sessionId: options.auth?.sessionId,
    sessionStartedAt: options.auth?.sessionStartedAt,
    maxRetries: options.auth?.maxRetries,
  };

  const retries = options.retry?.enabled === false ? 0 : (options.retry?.retries ?? 0);
  const baseDelayMs = options.retry?.baseDelayMs ?? 250;
  const maxDelayMs = options.retry?.maxDelayMs ?? 2500;
  const retryOnStatuses = options.retry?.retryOnStatuses ?? [408, 429, 500, 502, 503, 504];
  const shouldRetry = options.retry?.shouldRetry;
  const accept = inFlightGetAccept(request);
  const inFlightKey = (shouldShareInFlight(options) && isInFlightMethod(method))
    ? resolveInFlightKey(options, method, target, accept, {
      enabled: authEnabled,
      scope,
      sessionId: options.auth?.sessionId,
    })
    : null;
  const authKey = buildAuthKey({
    enabled: authEnabled,
    scope,
    sessionId: options.auth?.sessionId,
  });

  try {
    let attempt = 0;
    while (true) {
      try {
        const init: RequestInit = { ...request, method, signal };
        if (inFlightKey) {
          const entry = getInFlightEntry(inFlightKey, authKey);
          if (entry) {
            const shared = await entry.promise;
            return shared.clone();
          }
        }
        const fetchPromise = (async () => {
          if (isAuthDebugEnabled()) {
            console.debug('[download][smartFetch] executing fetch', {
              authEnabled,
              target,
              method,
              attempt,
              hasAuthHeaders: authEnabled,
            });
          }

          return authEnabled
            ? await (await AuthService.getSingleton()).fetchWithAuth(target, init, ctx)
            : await fetch(target, init);
        })();
        if (inFlightKey) {
          registerInFlight(inFlightKey, authKey, fetchPromise);
        }
        const res = await fetchPromise;
        const withProgress = options.onDownloadProgress
          ? await attachDownloadProgress(res, options.onDownloadProgress)
          : res;

        const needRetry = shouldRetry
          ? shouldRetry(withProgress)
          : shouldRetryStatus(withProgress.status, retryOnStatuses);

        if (retries > 0 && needRetry && attempt < retries) {
          await sleep(backoff(attempt++, baseDelayMs, maxDelayMs));
          continue;
        }
        return withProgress;
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

const resolveTotalBytes = (headers: Headers): number | undefined => {
  const header = headers.get('content-length');
  if (!header) return undefined;
  const parsed = Number.parseInt(header, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
};

const mergeChunks = (chunks: Uint8Array[], totalBytes: number): Uint8Array => {
  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
};

const attachDownloadProgress = async (
  response: Response,
  onDownloadProgress: NonNullable<SmartFetchOptions['onDownloadProgress']>,
): Promise<Response> => {
  if (!response.ok) {
    return response;
  }
  if (!response.body) {
    const totalBytes = resolveTotalBytes(response.headers);
    await onDownloadProgress({
      loadedBytes: totalBytes ?? 0,
      totalBytes,
      percentage: totalBytes ? 100 : undefined,
    });
    return response;
  }

  const totalBytes = resolveTotalBytes(response.headers);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loadedBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value || value.byteLength <= 0) continue;
    chunks.push(value);
    loadedBytes += value.byteLength;
    const percentage = totalBytes ? (loadedBytes / totalBytes) * 100 : undefined;
    await onDownloadProgress({ loadedBytes, totalBytes, percentage });
  }
  if (totalBytes) {
    await onDownloadProgress({ loadedBytes: totalBytes, totalBytes, percentage: 100 });
  }

  const body = mergeChunks(chunks, loadedBytes);
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};
