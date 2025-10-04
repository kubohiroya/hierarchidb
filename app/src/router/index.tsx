import {
  createRouter,
  createRootRoute,
  createHashHistory,
  createBrowserHistory,
} from '@tanstack/react-router';
import type { Router as ReactRouter } from 'react-router-dom';

export type RouterMode = 'browser' | 'hash';
export type RouterEngine = 'react-router' | 'tanstack';

export interface RouterConfig {
  mode: RouterMode;
  basename?: string;
}

export interface HierarchiRouter {
  mode: RouterMode;
  engine: RouterEngine;
  instance: any; // ReactRouter or TanStack Router
}

/**
 * Creates a router instance based on the specified mode
 * Supports both browser and hash routing modes
 * 
 * @param config - Router configuration with mode and optional basename
 * @returns Router instance for TanStack Router
 */
export function createHierarchiRouter(config: RouterConfig) {
  const { mode, basename } = config;

  // Create root route for TanStack Router
  const rootRoute = createRootRoute({
    component: () => (
      <div>TanStack Router Root - Not yet fully configured</div>
    ),
  });

  // Create route tree (for now just root)
  const routeTree = rootRoute;

  // Create appropriate history based on mode
  const history =
    mode === 'hash'
      ? createHashHistory()
      : createBrowserHistory();

  // Create TanStack router
  const router = createRouter({
    routeTree,
    history,
    defaultPreload: 'intent',
    basepath: basename && basename !== '/' ? basename : undefined,
  });

  return router;
}

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
