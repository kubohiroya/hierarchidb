/**
 * Folder View Routes for TanStack Router
 *
 * URL patterns:
 *   /f/:treeId/:pageNodeId/-/folder/icon/:sortMode?    → IconView
 *   /f/:treeId/:pageNodeId/-/folder/list/:sortMode?    → ListView
 *   /f/:treeId/:pageNodeId/:targetNodeId/folder/column/:sortMode?  → ColumnView
 *
 * sortMode defaults to 'name' when omitted.
 */

import { createRoute, Outlet } from '@tanstack/react-router';
import { loadTree, loadPageNode } from '~/router/loaders/treeLoaders';
import { folderBaseRoute } from './baseRoute.js';
import { FolderViewPage } from './FolderViewPage.js';

// /f/:treeId
export const folderTreeRoute = createRoute({
    getParentRoute: () => folderBaseRoute,
    path: '$treeId',
    shouldReload: false,
    staleTime: Infinity,
    loader: async ({ params }) => {
        const { treeId } = params;
        if (!treeId) throw new Error('Missing treeId');
        return await loadTree({ treeId });
    },
    component: () => <Outlet />,
});

// /f/:treeId/:pageNodeId
export const folderPageRoute = createRoute({
    getParentRoute: () => folderTreeRoute,
    path: '$pageNodeId',
    shouldReload: false,
    staleTime: Infinity,
    loader: async ({ params }) => {
        const { treeId, pageNodeId } = params;
        if (!treeId) throw new Error('Missing treeId');
        const resolvedPageNodeId = pageNodeId ?? `${treeId}:root`;
        return await loadPageNode({ treeId, pageNodeId: resolvedPageNodeId });
    },
    component: () => <Outlet />,
});

// /f/:treeId/:pageNodeId/:targetNodeId/folder/:viewMode
export const folderViewRoute = createRoute({
    getParentRoute: () => folderPageRoute,
    path: '$targetNodeId/folder/$viewMode',
    component: FolderViewPage,
});

// /f/:treeId/:pageNodeId/:targetNodeId/folder/:viewMode/:sortMode
export const folderViewSortRoute = createRoute({
    getParentRoute: () => folderPageRoute,
    path: '$targetNodeId/folder/$viewMode/$sortMode',
    component: FolderViewPage,
});
