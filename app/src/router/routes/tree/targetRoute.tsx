/**
 * console Target Route for TanStack Router
 *
 * This route handles the `/d/:treeId/:pageNodeId/:targetNodeId` path and loads the target node data.
 * Corresponds to React Router route `t.($treeId).($pageNodeId).($targetNodeId).tsx`
 */

import { createRoute, Outlet } from '@tanstack/react-router';
import { loadPageNode, loadTargetNode } from '~/router/loaders/treeLoaders';
import { treePageRoute } from './pageRoute.js';
export const treeTargetRoute = createRoute({
  getParentRoute: () => treePageRoute,
  path: '$targetNodeId',
  loader: async ({ params }) => {
    const { treeId, pageNodeId, targetNodeId } = params;
    if (!treeId || !targetNodeId) {
      throw new Error('Missing required parameters');
    }
    const resolvedPageNodeId = pageNodeId ?? `${treeId}:root`;
    if (targetNodeId === 'tags') {
      const pageData = await loadPageNode({ treeId, pageNodeId: resolvedPageNodeId });
      console.warn('tags');
      return {
        ...pageData,
        targetNodeId: resolvedPageNodeId,
        targetNode: pageData.pageNode,
      };
    }
    return await loadTargetNode({
      treeId,
      pageNodeId: resolvedPageNodeId,
      targetNodeId,
    });
  },
  component: TreeTargetLayout,
});

function TreeTargetLayout() {
  // Simple passthrough layout
  return <Outlet />;
}
