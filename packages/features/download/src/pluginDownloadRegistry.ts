import {
  createDownloadService,
  type DownloadServiceBundle,
  type DownloadServiceOptions,
} from './createDownloadService.js';
import type { AuthPluginType } from '@hierarchidb/auth-recovery';
import { authFetch } from './helpers/authFetch.js';
import { resolveNetworkUrl } from './helpers/resolveNetworkUrl.js';

type BackoffMode = 'linear' | 'exponential';

export type DownloadRetryOptions = {
  retries?: number;
  delayMs?: number;
  backoff?: BackoffMode;
};

export type PluginDownloadOptions = DownloadServiceOptions;

export type DownloadJsonOptions = DownloadRetryOptions & {
  cache?: 'conditional';
  accept?: string;
  headers?: Record<string, string>;
  allowStale?: boolean;
};

type Factory = (opts?: PluginDownloadOptions) => Promise<DownloadServiceBundle>;

type AuthNotification = {
  resource: string;
  provider?: string;
  hint?: string;
  status?: number;
};

const factories = new Map<string, Factory>();
const defaults = new Map<string, PluginDownloadOptions>();
const cache = new Map<string, Promise<DownloadServiceBundle>>();
const authNotifiers = new Map<string, (info: AuthNotification) => void>();

function resolvePluginType(pluginId: string): AuthPluginType | undefined {
  switch (pluginId) {
    case 'shape':
    case 'location':
    case 'route':
    case 'spreadsheet':
    case 'styler':
      return pluginId;
    case 'generic':
      return 'generic';
    default:
      return undefined;
  }
}

function mergeOptions(
  pluginId: string,
  opts?: PluginDownloadOptions,
): PluginDownloadOptions | undefined {
  const resolvedPluginType = resolvePluginType(pluginId);
  const merged: PluginDownloadOptions = {
    ...(defaults.get(pluginId) ?? {}),
    ...(opts ?? {}),
  };
  if (!merged.pluginType && resolvedPluginType) {
    merged.pluginType = resolvedPluginType;
  }
  if (merged.dbPrefix == null) delete merged.dbPrefix;
  if (merged.perHostConcurrency == null) delete merged.perHostConcurrency;
  if (merged.corsProxyBaseURL == null) delete merged.corsProxyBaseURL;
  if (merged.pluginType == null) delete merged.pluginType;
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function buildCacheKey(pluginId: string, opts?: PluginDownloadOptions): string {
  if (!opts) return `${pluginId}:default`;
  const normalized = {
    dbPrefix: opts.dbPrefix ?? null,
    perHostConcurrency: opts.perHostConcurrency ?? null,
    corsProxyBaseURL: opts.corsProxyBaseURL ?? null,
    pluginType: opts.pluginType ?? null,
  };
  return `${pluginId}:${JSON.stringify(normalized)}`;
}

export function registerPluginDownloadServiceFactory(pluginId: string, factory: Factory): void {
  factories.set(pluginId, factory);
}

export function configurePluginDownloadDefaults(pluginId: string, opts: PluginDownloadOptions): void {
  const prev = defaults.get(pluginId) ?? {};
  defaults.set(pluginId, { ...prev, ...opts });
}

export async function getPluginDownloadService(
  pluginId: string,
  opts?: PluginDownloadOptions,
): Promise<DownloadServiceBundle> {
  const merged = mergeOptions(pluginId, opts);
  const key = buildCacheKey(pluginId, merged);
  const existing = cache.get(key);
  if (existing) return existing;
  const factory = factories.get(pluginId);
  const servicePromise = factory ? factory(merged) : createDownloadService(merged);
  cache.set(key, servicePromise);
  return servicePromise;
}

export function registerPluginAuthNotifier(pluginId: string, fn: (info: AuthNotification) => void): void {
  authNotifiers.set(pluginId, fn);
}

export function notifyPluginAuthRequired(pluginId: string, info: AuthNotification): void {
  const handler = authNotifiers.get(pluginId);
  if (handler) {
    handler(info);
    return;
  }
  const globalScope = globalThis as unknown as {
    AuthNotificationRegistry?: { getInstance?: () => { onAuthRequired?: (payload: AuthNotification) => void } };
    authNotificationRegistry?: { onAuthRequired?: (payload: AuthNotification) => void };
    authRegistry?: { onAuthRequired?: (payload: AuthNotification) => void };
  };
  const registry = globalScope.AuthNotificationRegistry?.getInstance?.()
    ?? globalScope.authNotificationRegistry
    ?? globalScope.authRegistry;
  registry?.onAuthRequired?.(info);
}

const hashString = (input: string): string => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
};

const buildDownloadFileId = (pluginId: string, prefix: string, url: string): string =>
  `${pluginId}:${prefix}:${hashString(url)}`;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'AbortError';

const readHeader = (headers: Headers | Record<string, string>, key: string): string | undefined => {
  if (headers instanceof Headers) {
    return headers.get(key) ?? undefined;
  }
  const target = key.toLowerCase();
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === target) {
      return value;
    }
  }
  return undefined;
};

const buildHeaders = (
  accept: string | undefined,
  extra: Record<string, string> | undefined,
  conditional?: { etag?: string; lastModified?: string },
): Headers => {
  const headers = new Headers(extra);
  if (accept) {
    headers.set('Accept', accept);
  }
  if (conditional?.etag) {
    headers.set('If-None-Match', conditional.etag);
  }
  if (conditional?.lastModified) {
    headers.set('If-Modified-Since', conditional.lastModified);
  }
  return headers;
};

const parseJson = <T>(buffer: ArrayBuffer): T => {
  const text = new TextDecoder('utf-8').decode(buffer);
  return JSON.parse(text) as T;
};

const parseText = (buffer: ArrayBuffer): string => (
  new TextDecoder('utf-8').decode(buffer)
);

export async function downloadArrayBuffer(
  pluginId: string,
  url: string,
  prefix: string,
  retryOptions: DownloadRetryOptions = {},
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const { service, readAll } = await getPluginDownloadService(pluginId);
  const resolvedUrl = resolveNetworkUrl(url);
  const retries = Math.max(1, retryOptions.retries ?? 1);
  const delayMs = Math.max(0, retryOptions.delayMs ?? 0);
  const backoff: BackoffMode = retryOptions.backoff ?? 'exponential';
  const fileId = buildDownloadFileId(pluginId, prefix, resolvedUrl);

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      await service.download(resolvedUrl, fileId, { signal });
      return await readAll(fileId);
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) {
        throw error;
      }
      if (attempt === retries - 1) {
        throw error;
      }
      if (delayMs > 0) {
        const wait = backoff === 'exponential'
          ? delayMs * 2 ** attempt
          : delayMs * (attempt + 1);
        await sleep(wait);
      }
    }
  }

  throw new Error('Download failed');
}

export async function downloadJson<T>(
  pluginId: string,
  url: string,
  prefix: string,
  options: DownloadJsonOptions = {},
  signal?: AbortSignal,
): Promise<T> {
  if (options.cache !== 'conditional') {
    const buffer = await downloadArrayBuffer(pluginId, url, prefix, options, signal);
    return parseJson<T>(buffer);
  }

  const { net, readAll, store } = await getPluginDownloadService(pluginId);
  const resolvedUrl = resolveNetworkUrl(url);
  const fileId = buildDownloadFileId(pluginId, prefix, resolvedUrl);
  const cachedMeta = await store.getMetadata?.(fileId);
  const acceptHeader = options.accept ?? 'application/json';
  const conditionalHeaders = cachedMeta && (cachedMeta.etag || cachedMeta.lastModified)
    ? { etag: cachedMeta.etag, lastModified: cachedMeta.lastModified }
    : undefined;

  const attemptFetch = async (useConditional: boolean): Promise<ArrayBuffer> => {
    const headers = buildHeaders(
      acceptHeader,
      options.headers,
      useConditional ? conditionalHeaders : undefined,
    );
    const response = await net.get(resolvedUrl, { headers, signal });
    if (response.status === 304) {
      try {
        const cachedBuffer = await readAll(fileId);
        return cachedBuffer;
      } catch (error) {
        if (useConditional) {
          return attemptFetch(false);
        }
        throw error;
      }
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    await store.putChunk(fileId, 0, buffer);
    await store.commit(fileId, {
      sizeBytes: buffer.byteLength,
      etag: readHeader(response.headers, 'etag'),
      lastModified: readHeader(response.headers, 'last-modified'),
      contentType: readHeader(response.headers, 'content-type'),
      fetchedAt: Date.now(),
    });
    return buffer;
  };

  const retries = Math.max(1, options.retries ?? 1);
  const delayMs = Math.max(0, options.delayMs ?? 0);
  const backoff: BackoffMode = options.backoff ?? 'exponential';
  let lastError: unknown;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const buffer = await attemptFetch(Boolean(conditionalHeaders));
      return parseJson<T>(buffer);
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) {
        throw error;
      }
      lastError = error;
      if (attempt === retries - 1) {
        break;
      }
      if (delayMs > 0) {
        const wait = backoff === 'exponential'
          ? delayMs * 2 ** attempt
          : delayMs * (attempt + 1);
        await sleep(wait);
      }
    }
  }

  if (options.allowStale !== false && cachedMeta) {
    try {
      const cachedBuffer = await readAll(fileId);
      return parseJson<T>(cachedBuffer);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error('Download failed');
}

export async function downloadText(
  pluginId: string,
  url: string,
  prefix: string,
  options: DownloadJsonOptions = {},
  signal?: AbortSignal,
): Promise<string> {
  if (options.cache !== 'conditional') {
    const buffer = await downloadArrayBuffer(pluginId, url, prefix, options, signal);
    return parseText(buffer);
  }

  const { net, readAll, store } = await getPluginDownloadService(pluginId);
  const resolvedUrl = resolveNetworkUrl(url);
  const fileId = buildDownloadFileId(pluginId, prefix, resolvedUrl);
  const cachedMeta = await store.getMetadata?.(fileId);
  const acceptHeader = options.accept ?? 'text/html';
  const conditionalHeaders = cachedMeta && (cachedMeta.etag || cachedMeta.lastModified)
    ? { etag: cachedMeta.etag, lastModified: cachedMeta.lastModified }
    : undefined;

  const attemptFetch = async (useConditional: boolean): Promise<ArrayBuffer> => {
    const headers = buildHeaders(
      acceptHeader,
      options.headers,
      useConditional ? conditionalHeaders : undefined,
    );
    const response = await net.get(resolvedUrl, { headers, signal });
    if (response.status === 304) {
      try {
        const cachedBuffer = await readAll(fileId);
        return cachedBuffer;
      } catch (error) {
        if (useConditional) {
          return attemptFetch(false);
        }
        throw error;
      }
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    await store.putChunk(fileId, 0, buffer);
    await store.commit(fileId, {
      sizeBytes: buffer.byteLength,
      etag: readHeader(response.headers, 'etag'),
      lastModified: readHeader(response.headers, 'last-modified'),
      contentType: readHeader(response.headers, 'content-type'),
      fetchedAt: Date.now(),
    });
    return buffer;
  };

  const retries = Math.max(1, options.retries ?? 1);
  const delayMs = Math.max(0, options.delayMs ?? 0);
  const backoff: BackoffMode = options.backoff ?? 'exponential';
  let lastError: unknown;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const buffer = await attemptFetch(Boolean(conditionalHeaders));
      return parseText(buffer);
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) {
        throw error;
      }
      lastError = error;
      if (attempt === retries - 1) {
        break;
      }
      if (delayMs > 0) {
        const wait = backoff === 'exponential'
          ? delayMs * 2 ** attempt
          : delayMs * (attempt + 1);
        await sleep(wait);
      }
    }
  }

  if (options.allowStale !== false && cachedMeta) {
    try {
      const cachedBuffer = await readAll(fileId);
      return parseText(cachedBuffer);
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error('Download failed');
}

export async function postJson<T = unknown>(
  pluginId: string,
  url: string,
  body: string | object,
  headers?: Record<string, string>,
  init?: RequestInit,
): Promise<T> {
  const pluginType = resolvePluginType(pluginId) ?? 'generic';
  const resolvedUrl = resolveNetworkUrl(url);
  const mergedHeaders = new Headers(init?.headers);
  if (!mergedHeaders.has('Content-Type')) {
    mergedHeaders.set(
      'Content-Type',
      typeof body === 'string' ? 'application/x-www-form-urlencoded' : 'application/json',
    );
  }
  if (headers) {
    Object.entries(headers).forEach(([key, value]) => mergedHeaders.set(key, value));
  }
  const initBody = typeof body === 'string' ? body : JSON.stringify(body);
  const requestInit: RequestInit = {
    ...init,
    method: 'POST',
    body: initBody,
    headers: mergedHeaders,
  };
  const response = await authFetch(pluginType, resolvedUrl, requestInit);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}
