/**
 * console Page Route for TanStack Router
 *
 * This route handles the `/t/:treeId/:pageNodeId` path and loads the page node data.
 * It displays the TreeConsoleIntegration component with AppBar.
 * Corresponds to React Router route `t.($treeId).($pageNodeId).tsx`
 */

import { createRoute } from '@tanstack/react-router';
import { loadPageNode } from '../../loaders/treeLoaders.js';
// Import the existing React Router component to reuse
import TreePageLayout from '../t.($treeId).($pageNodeId).js';
import { treeLayoutRoute } from './layoutRoute.js';

export const treePageRoute = createRoute({
  getParentRoute: () => treeLayoutRoute,
  path: '$pageNodeId',
  loader: async ({ params }) => {
    const { treeId, pageNodeId } = params;
    if (!treeId) {
      throw new Error('Missing treeId parameter');
    }
    const resolvedPageNodeId = pageNodeId ?? `${treeId}:root`;
    return await loadPageNode({ treeId, pageNodeId: resolvedPageNodeId });
  },
  component: TreePageLayout,
});
