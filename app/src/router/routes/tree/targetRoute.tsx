/**
 * console Target Route for TanStack Router
 *
 * This route handles the `/t/:treeId/:pageNodeId/:targetNodeId` path and loads the target node data.
 * Corresponds to React Router route `t.($treeId).($pageNodeId).($targetNodeId).tsx`
 */

import { createRoute, Outlet, redirect } from '@tanstack/react-router';
import { loadTargetNode } from '../../loaders/treeLoaders.js';
import { treePageRoute } from './pageRoute.js';
import { treeTagsRoute } from './tagsRoute.js';
export const treeTargetRoute = createRoute({
  getParentRoute: () => treePageRoute,
  path: '$targetNodeId',
  loader: async ({ params }) => {
    const { treeId, pageNodeId, targetNodeId } = params;
    if (!treeId || !targetNodeId) {
      throw new Error('Missing required parameters');
    }
    if (targetNodeId === 'tags') {
      throw redirect({
        to: treeTagsRoute.to,
        params: {
          treeId,
          pageNodeId,
        },
        replace: true,
      });
    }
    const resolvedPageNodeId = pageNodeId ?? `${treeId}:root`;
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
