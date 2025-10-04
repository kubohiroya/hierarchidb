/**
 * Tree Layout Route for TanStack Router
 * 
 * This route handles the `/t/:treeId` path and loads the tree data.
 * It corresponds to the React Router route `t.($treeId)._layout.tsx`
 */

import { createRoute, Outlet } from '@tanstack/react-router';
import { rootRoute } from '../rootRoute.js';
import { loadTree } from '../../loaders/treeLoaders.js';

export const treeLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 't/$treeId',
  loader: async ({ params }) => {
    const { treeId } = params;
    if (!treeId) {
      throw new Error('Missing treeId parameter');
    }
    return await loadTree({ treeId });
  },
  component: TreeLayout,
});

function TreeLayout() {
  return <Outlet />;
}
