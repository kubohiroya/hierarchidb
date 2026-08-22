import { shouldUseLocalProxy, toLocalProxyUrl } from './localProxyUtils.js';

export interface ResolveNetworkUrlOptions {
  corsProxyBaseURL?: string;
}

let storedCorsProxyBaseURL = '';

export function setCorsProxyBaseURL(value?: string | null): void {
  if (typeof value === 'string') {
    storedCorsProxyBaseURL = value.trim();
  } else {
    storedCorsProxyBaseURL = '';
  }
}

export function getCorsProxyBaseURL(): string {
  return storedCorsProxyBaseURL;
}

export function resolveNetworkUrl(url: string, opts: ResolveNetworkUrlOptions = {}): string {
  if (shouldUseLocalProxy(url)) {
    return toLocalProxyUrl(url);
  }
  const corsProxyBaseURL = resolveCorsProxyBaseURL(opts.corsProxyBaseURL);
  if (!shouldUseCorsProxy(url, corsProxyBaseURL)) {
    return url;
  }
  return toCorsProxyUrl(corsProxyBaseURL, url);
}

function resolveCorsProxyBaseURL(explicit?: string): string {
  if (explicit && explicit.trim().length > 0) {
    return explicit.trim();
  }
  return getCorsProxyBaseURL();
}

function shouldUseCorsProxy(url: string, corsProxyBaseURL: string): boolean {
  if (!corsProxyBaseURL) return false;
  if (!isBrowserRuntime()) return false;
  if (!isHttpUrl(url)) return false;
  if (isCorsProxyUrl(url, corsProxyBaseURL)) return false;
  const origin = getOrigin();
  if (!origin) return true;
  try {
    const target = new URL(url);
    return target.origin !== origin;
  } catch {
    return false;
  }
}

function isCorsProxyUrl(url: string, corsProxyBaseURL: string): boolean {
  try {
    return new URL(url).origin === new URL(corsProxyBaseURL).origin;
  } catch {
    return false;
  }
}

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function toCorsProxyUrl(corsProxyBaseURL: string, targetUrl: string): string {
  const proxy = new URL(corsProxyBaseURL);
  proxy.searchParams.set('url', targetUrl);
  return proxy.toString();
}

function isBrowserRuntime(): boolean {
  if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
    return true;
  }
  if (
    typeof self !== 'undefined' &&
    typeof (self as { location?: Location }).location !== 'undefined'
  ) {
    return true;
  }
  return false;
}

function getOrigin(): string | null {
  try {
    const workerScope = typeof self !== 'undefined' ? (self as { location?: Location }) : undefined;
    const globalScope = globalThis as { location?: Location };
    const candidate =
      typeof window !== 'undefined'
        ? window.location
        : (workerScope?.location ?? globalScope.location);
    if (!candidate) return null;
    return `${candidate.protocol}//${candidate.host}`;
  } catch {
    return null;
  }
}
