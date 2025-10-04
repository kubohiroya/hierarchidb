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
export async function createHierarchiRouter(config: RouterConfig) {
  const { mode, basename } = config;

  // Import route definitions dynamically
  const { rootRoute } = await import('./routes/rootRoute.js');
  const { indexRoute } = await import('./routes/indexRoute.js');
  const { infoRoute } = await import('./routes/infoRoute.js');
  const { mapRoute } = await import('./routes/mapRoute.js');
  const { 
    authLoginRoute, 
    authCallbackRoute, 
    authSilentRenewRoute 
  } = await import('./routes/authRoutes.js');
  const {
    tagsRoute,
    tagDetailRoute,
    pluginsRoute,
    pluginDemoRoute,
    workerTestRoute,
    testRoute,
  } = await import('./routes/utilityRoutes.js');

  // Import tree routes
  const { treeBaseRoute } = await import('./routes/tree/baseRoute.js');
  const { treeLayoutRoute } = await import('./routes/tree/layoutRoute.js');
  const { treePageRoute } = await import('./routes/tree/pageRoute.js');
  const { treeTargetRoute } = await import('./routes/tree/targetRoute.js');
  const { treeNodeTypeRoute } = await import('./routes/tree/nodeTypeRoute.js');
  const { treeDialogRoute } = await import('./routes/tree/dialogRoute.js');

  // Build the tree route hierarchy
  // The hierarchy is: base -> layout -> page -> target -> nodeType -> dialog
  const treeRouteWithChildren = treeBaseRoute.addChildren([
    treeLayoutRoute.addChildren([
      treePageRoute.addChildren([
        treeTargetRoute.addChildren([
          treeNodeTypeRoute.addChildren([
            treeDialogRoute,
          ]),
        ]),
      ]),
    ]),
  ]);

  // Create route tree with all top-level routes
  const routeTree = rootRoute.addChildren([
    indexRoute,
    infoRoute,
    mapRoute,
    authLoginRoute,
    authCallbackRoute,
    authSilentRenewRoute,
    tagsRoute,
    tagDetailRoute,
    pluginsRoute,
    pluginDemoRoute,
    workerTestRoute,
    testRoute,
    treeRouteWithChildren,
  ]);

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
