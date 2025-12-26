import {
  createDownloadService,
  type DownloadServiceBundle,
  type DownloadServiceOptions,
} from './createDownloadService.js';
import type { AuthPluginType } from '@hierarchidb/auth-recovery';
import { resolveNetworkUrl } from './helpers/resolveNetworkUrl.js';

type BackoffMode = 'linear' | 'exponential';

export type DownloadRetryOptions = {
  retries?: number;
  delayMs?: number;
  backoff?: BackoffMode;
};

export type PluginDownloadOptions = DownloadServiceOptions;

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
  retryOptions: DownloadRetryOptions = {},
  signal?: AbortSignal,
): Promise<T> {
  const buffer = await downloadArrayBuffer(pluginId, url, prefix, retryOptions, signal);
  const text = new TextDecoder('utf-8').decode(buffer);
  return JSON.parse(text) as T;
}
