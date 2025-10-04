import { createRouter } from '@tanstack/react-router';
import type { RouterMode } from './config.js';

export type { RouterMode } from './config.js';
export { getRouterMode, getBasePath } from './config.js';
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
  const { basename } = config;

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
    treeRouteWithChildren,
  ]);

  // Create appropriate history based on mode

  // Create TanStack router
  const router = createRouter({
    routeTree,
    defaultPreload: 'intent',
    basepath: basename && basename !== '/' ? basename : undefined,
  });

  return router;
}
