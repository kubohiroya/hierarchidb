import {
  createBrowserHistory,
  createHashHistory,
  createMemoryHistory,
  createRouter,
} from '@tanstack/react-router';
import type { RouterMode } from './config.js';

export type { RouterMode } from './config.js';
export { getBasePath, getRouterMode } from './config.js';
export type RouterEngine = 'react-router' | 'tanstack';

export interface RouterConfig {
  mode: RouterMode;
  basename?: string;
}

export type AppRouterInstance = ReturnType<typeof createRouter>;

export interface HierarchiRouter {
  mode: RouterMode;
  engine: RouterEngine;
  instance: AppRouterInstance;
}

/**
 * Creates a router instance based on the specified mode
 * Supports both browser and hash routing modes
 *
 * @param config - Router configuration with mode and optional basename
 * @returns Router instance for TanStack Router
 */
export async function createHierarchiRouter(config: RouterConfig) {
  const { basename, mode } = config;

  // Import route definitions dynamically
  const { rootRoute } = await import('./routes/rootRoute.js');
  const { indexRoute } = await import('./routes/indexRoute.js');
  const { infoRoute } = await import('./routes/infoRoute.js');
  const { mapRoute } = await import('./routes/mapRoute.js');
  const { authLoginRoute, authCallbackRoute, authSilentRenewRoute } = await import(
    './routes/auth/index.js'
  );
  const { tagsRoute, tagDetailRoute, pluginsRoute } = await import('./routes/utilityRoutes.js');

  // Import console routes
  const { treeBaseRoute } = await import('./routes/tree/baseRoute.js');
  const { treeLayoutRoute } = await import('./routes/tree/layoutRoute.js');
  const { treeLayoutIndexRoute } = await import('./routes/tree/indexRoute.js');
  const { treePageRoute } = await import('./routes/tree/pageRoute.js');
  const { treeTagsRoute, treeTagDetailRoute } = await import(
    './routes/tree/tagsRoute.js'
  );
  const { treeTargetRoute } = await import('./routes/tree/targetRoute.js');
  const { treeNodeTypeRoute } = await import('./routes/tree/nodeTypeRoute.js');
  const { treeDialogRoute, treeDialogModeRoute, treeDialogModeStepRoute } = await import(
    './routes/tree/dialogRoute.js'
  );

  // Build the console route hierarchy
  // The hierarchy is: base -> layout -> page -> target -> nodeType -> dialog
  const treeRouteWithChildren = treeBaseRoute.addChildren([
    treeLayoutRoute.addChildren([
      treeLayoutIndexRoute,
      treePageRoute.addChildren([
        treeTagsRoute.addChildren([treeTagDetailRoute]),
        treeTargetRoute.addChildren([
          treeNodeTypeRoute.addChildren([
            treeDialogRoute,
            treeDialogModeRoute,
            treeDialogModeStepRoute,
          ]),
        ]),
      ]),
    ]),
  ]);

  // Create route console with all top-level routes
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

  const normalizedBasepath = basename && basename !== '/' ? basename : undefined;
  const hasWindow = typeof window !== 'undefined';
  const history = hasWindow
    ? mode === 'hash'
      ? createHashHistory({ window })
      : createBrowserHistory({ window })
    : createMemoryHistory({ initialEntries: [normalizedBasepath ?? '/'] });

  const router = createRouter({
    routeTree,
    defaultPreload: 'intent',
    history,
    basepath: mode === 'hash' ? undefined : normalizedBasepath,
  });

  return router;
}
