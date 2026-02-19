/**
 * console Layout Route for TanStack Router
 *
 * This route handles the `/t/:treeId` path and loads the console data.
 * It corresponds to the React Router route `t.($treeId)._layout.tsx`
 */

import { createRoute, Outlet } from '@tanstack/react-router';
import { loadTree } from '~/router/loaders/treeLoaders';
import { treeBaseRoute } from './baseRoute.js';

export const treeLayoutRoute = createRoute({
  getParentRoute: () => treeBaseRoute,
  path: '$treeId',
  shouldReload: false,
  staleTime: Infinity,
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
