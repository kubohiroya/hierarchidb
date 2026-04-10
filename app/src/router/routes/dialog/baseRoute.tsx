/**
 * Base Dialog Route for TanStack Router
 *
 * Handles the `/d` path prefix for all dialog routes.
 * Shares the same Worker initialization as the tree base route.
 */

import { createRoute, Outlet } from '@tanstack/react-router';
import { loadWorkerAPIClient } from '~/router/loaders/treeLoaders';
import { rootRoute } from '~/router/routes/rootRoute';

export const dialogBaseRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'd',
    shouldReload: false,
    staleTime: Infinity,
    loader: async () => {
        return await loadWorkerAPIClient();
    },
    component: () => <Outlet />,
});
