/**
 * Dialog Routes under /d/ prefix.
 *
 * Mirrors the existing /t/ dialog route chain but under /d/:
 *   /d/:treeId/:pageNodeId/:targetNodeId/:nodeType/:action/:mode?/:step?
 */

import { createRoute, Outlet } from '@tanstack/react-router';
import { loadTree, loadPageNode, loadTargetNode, loadNodeType } from '~/router/loaders/treeLoaders';
import { dialogBaseRoute } from './baseRoute.js';

// /d/:treeId
export const dialogTreeRoute = createRoute({
    getParentRoute: () => dialogBaseRoute,
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

// /d/:treeId/:pageNodeId
export const dialogPageRoute = createRoute({
    getParentRoute: () => dialogTreeRoute,
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

// /d/:treeId/:pageNodeId/:targetNodeId
export const dialogTargetRoute = createRoute({
    getParentRoute: () => dialogPageRoute,
    path: '$targetNodeId',
    loader: async ({ params }) => {
        const { treeId, pageNodeId, targetNodeId } = params;
        if (!treeId || !targetNodeId) throw new Error('Missing required parameters');
        const resolvedPageNodeId = pageNodeId ?? `${treeId}:root`;
        return await loadTargetNode({ treeId, pageNodeId: resolvedPageNodeId, targetNodeId });
    },
    component: () => <Outlet />,
});

// /d/:treeId/:pageNodeId/:targetNodeId/:nodeType
export const dialogNodeTypeRoute = createRoute({
    getParentRoute: () => dialogTargetRoute,
    path: '$nodeType',
    loader: async ({ params }) => {
        const { treeId, pageNodeId, targetNodeId, nodeType } = params;
        if (!treeId || !targetNodeId || !nodeType) throw new Error('Missing required parameters');
        const resolvedPageNodeId = pageNodeId ?? `${treeId}:root`;
        return await loadNodeType({ treeId, pageNodeId: resolvedPageNodeId, targetNodeId, nodeType });
    },
    component: () => <Outlet />,
});
