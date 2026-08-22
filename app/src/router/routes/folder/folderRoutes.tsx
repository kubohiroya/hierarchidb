/**
 * Folder View Routes for TanStack Router
 *
 * URL patterns:
 *   /f/:treeId                                              → redirect to root folder list
 *   /f/:treeId/:pageNodeId                                  → redirect to folder list
 *   /f/:treeId/:pageNodeId/:targetNodeId/folder/:viewMode   → folder view
 *   /f/:treeId/:pageNodeId/:targetNodeId/folder/:viewMode/:sortMode → folder view with sort
 */

import { createRoute, Outlet, redirect } from '@tanstack/react-router';
import { loadPageNode, loadTree } from '~/router/loaders/treeLoaders';
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

// /f/:treeId/ (index) → redirect to default folder view
export const folderTreeIndexRoute = createRoute({
  getParentRoute: () => folderTreeRoute,
  path: '/',
  beforeLoad: ({ params }) => {
    const { treeId } = params;
    throw redirect({ to: `/f/${treeId}/${treeId}:root/-/folder/list` });
  },
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

// /f/:treeId/:pageNodeId/ (index) → redirect to default folder view
export const folderPageIndexRoute = createRoute({
  getParentRoute: () => folderPageRoute,
  path: '/',
  beforeLoad: ({ params }) => {
    const { treeId, pageNodeId } = params;
    throw redirect({ to: `/f/${treeId}/${pageNodeId}/-/folder/list` });
  },
});

// /f/:treeId/:pageNodeId/:targetNodeId/folder/:viewMode/:sortMode
export const folderViewSortRoute = createRoute({
  getParentRoute: () => folderPageRoute,
  path: '$targetNodeId/folder/$viewMode/$sortMode',
  loader: async ({ params }) => {
    const { treeId, pageNodeId } = params;
    if (!treeId) throw new Error('Missing treeId');
    return await loadPageNode({ treeId, pageNodeId: pageNodeId ?? `${treeId}:root` });
  },
  component: FolderViewPage,
});

// /f/:treeId/:pageNodeId/:targetNodeId/folder/:viewMode
export const folderViewRoute = createRoute({
  getParentRoute: () => folderPageRoute,
  path: '$targetNodeId/folder/$viewMode',
  loader: async ({ params }) => {
    const { treeId, pageNodeId } = params;
    if (!treeId) throw new Error('Missing treeId');
    return await loadPageNode({ treeId, pageNodeId: pageNodeId ?? `${treeId}:root` });
  },
  component: FolderViewPage,
});
