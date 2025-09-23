/*
 * Local dev proxy helper for CORS escape hatch.
 * When HDB_LOCAL_PROXY is "1", cross-origin requests can be routed through
 * the app’s Vite dev proxy mounted at `${BASE_URL}/proxy` (and also at
 * `/hierarchidb/proxy`).
 */

function getEnvFlag(): boolean {
  try {
    const meta = import.meta as ImportMeta & { env?: Record<string, unknown> };
    const env = meta.env ?? {};
    const raw = env.HDB_LOCAL_PROXY ?? env.VITE_HDB_LOCAL_PROXY ?? env.PUBLIC_HDB_LOCAL_PROXY;
    return raw != null && String(raw).toLowerCase() === '1';
  } catch {
    return false;
  }
}

function getOrigin(): string | null {
  try {
    const workerScope = typeof self !== 'undefined' ? (self as unknown as { location?: Location }) : undefined;
    const globalScope = globalThis as { location?: Location };
    const candidate = typeof window !== 'undefined'
      ? window.location
      : workerScope?.location ?? globalScope.location;
    if (!candidate) return null;
    return `${candidate.protocol}//${candidate.host}`;
  } catch {
    return null;
  }
}

function readEnvBasePath(): string | null {
  try {
    const meta = import.meta as ImportMeta & { env?: Record<string, unknown> };
    const envBase = typeof meta.env?.BASE_URL === 'string' ? meta.env.BASE_URL : undefined;
    if (!envBase) return null;
    return envBase.endsWith('/') ? envBase : `${envBase}/`;
  } catch (error) {
    // Accessing import.meta.env can throw when not defined by the bundler.
    void error;
    return null;
  }
}

function readDocumentBasePath(): string | null {
  try {
    if (typeof document === 'undefined' || !document.baseURI) return null;
    const pathname = new URL(document.baseURI).pathname || '/';
    return pathname.endsWith('/') ? pathname : `${pathname}/`;
  } catch (error) {
    // Parsing document.baseURI can fail in worker contexts or malformed URLs.
    void error;
    return null;
  }
}

function getBasePath(): string {
  // Prefer Vite base, fallback to <base href> or '/'
  const envBase = readEnvBasePath();
  if (envBase) return envBase;

  const documentBase = readDocumentBasePath();
  if (documentBase) return documentBase;

  return '/';
}

export function isLocalProxyEnabled(): boolean {
  return getEnvFlag();
}

export function shouldUseLocalProxy(targetUrl: string): boolean {
  if (!isLocalProxyEnabled()) return false;
  // Only proxy http/https and only when cross-origin
  try {
    const url = new URL(targetUrl, getOrigin() || undefined);
    if (!/^https?:$/.test(url.protocol)) return false;
    const origin = getOrigin();
    if (!origin) return false;
    const sameOrigin = `${url.protocol}//${url.host}` === origin;
    return !sameOrigin;
  } catch {
    return false;
  }
}

export function toLocalProxyUrl(targetUrl: string): string {
  const base = getBasePath().replace(/\/+$/, '');
  // Prefer base-prefixed /proxy; fallback path /hierarchidb/proxy
  const primary = `${base}/proxy/?url=${encodeURIComponent(targetUrl)}`.replace(/\/{2,}/g, '/').replace(':/', '://');
  return primary;
}
