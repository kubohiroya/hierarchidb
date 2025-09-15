/*
 * Local dev proxy helper for CORS escape hatch.
 * When HDB_LOCAL_PROXY is "1", cross-origin requests can be routed through
 * the app’s Vite dev proxy mounted at `${BASE_URL}/proxy` (and also at
 * `/hierarchidb/proxy`).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

function getEnvFlag(): boolean {
  try {
    const env: any = (import.meta as any)?.env || {};
    const raw = env.HDB_LOCAL_PROXY ?? env.VITE_HDB_LOCAL_PROXY ?? env?.PUBLIC_HDB_LOCAL_PROXY;
    return String(raw) === '1';
  } catch {
    return false;
  }
}

function getOrigin(): string | null {
  try {
    // window in main thread; self in worker
    const loc: any = typeof window !== 'undefined' ? window.location : (typeof self !== 'undefined' ? (self as any).location : null);
    if (!loc) return null;
    return `${loc.protocol}//${loc.host}`;
  } catch {
    return null;
  }
}

function getBasePath(): string {
  // Prefer Vite base, fallback to <base href> or '/'
  try {
    const envBase = (import.meta as any)?.env?.BASE_URL as string | undefined;
    if (envBase) return envBase.endsWith('/') ? envBase : envBase + '/';
  } catch {}
  try {
    if (typeof document !== 'undefined' && (document as any).baseURI) {
      const p = new URL((document as any).baseURI).pathname || '/';
      return p.endsWith('/') ? p : p + '/';
    }
  } catch {}
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

