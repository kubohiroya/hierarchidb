export type RouterMode = 'browser' | 'hash';

/**
 * Helper to determine router mode from environment variables
 * Priority: VITE_ROUTER_MODE > Vite MODE (dev=browser / prod=hash) > legacy hash flag
 */
export function getRouterMode(): RouterMode {
  const explicitMode = import.meta.env.VITE_ROUTER_MODE?.toLowerCase();
  if (explicitMode === 'hash' || explicitMode === 'browser') {
    return explicitMode;
  }

  const normalizedMode = import.meta.env.MODE?.toLowerCase();
  if (normalizedMode === 'development') {
    return 'browser';
  }

  if (normalizedMode === 'production') {
    return 'hash';
  }

  const hashFlag = import.meta.env.VITE_USE_HASH_ROUTING;
  if (typeof hashFlag === 'string' && hashFlag.toLowerCase() !== 'false') {
    return 'hash';
  }

  return 'browser';
}

/**
 * Helper to get base path from environment
 * Handles BASE_URL and ensures proper format
 */
export function getBasePath(): string {
  const base = import.meta?.env?.BASE_URL ?? '/';
  if (typeof base !== 'string') return '/';
  return base.endsWith('/') ? base.slice(0, -1) || '/' : base;
}
