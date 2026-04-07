/**
 * Base Folder View Route for TanStack Router
 *
 * Handles the `/f` path prefix for folder view routes.
 * URL pattern: /f/:treeId/:pageNodeId/:targetNodeId/folder/:viewMode/:sortMode?
 */

import { createRoute, Outlet } from '@tanstack/react-router';
import { loadWorkerAPIClient } from '~/router/loaders/treeLoaders';
import { rootRoute } from '~/router/routes/rootRoute';

export const folderBaseRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'f',
    shouldReload: false,
    staleTime: Infinity,
    loader: async () => {
        return await loadWorkerAPIClient();
    },
    component: () => <Outlet />,
});
