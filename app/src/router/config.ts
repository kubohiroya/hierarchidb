export type RouterMode = 'browser' | 'hash';

/**
 * Helper to determine router mode from environment variables
 * Priority: VITE_ROUTER_MODE > default to 'browser'
 */
export function getRouterMode(): RouterMode {
  const mode = import.meta.env.VITE_ROUTER_MODE?.toLowerCase();
  if (mode === 'hash' || mode === 'browser') {
    return mode;
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
