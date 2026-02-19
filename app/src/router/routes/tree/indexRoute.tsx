/**
 * console Index Route for TanStack Router
 *
 * Handles the `/t/:treeId` path (without pageNodeId) and loads the console root node.
 */

import { createRoute } from '@tanstack/react-router';
import type { LoadPageNodeReturn } from '~/router/loaders/treeLoaders';
import { loadPageNode } from '~/router/loaders/treeLoaders';
import { TreeLayoutBody } from '~/router/routes/t.($treeId).($pageNodeId)';
import { treeLayoutRoute } from './layoutRoute.js';

export const treeLayoutIndexRoute = createRoute({
  getParentRoute: () => treeLayoutRoute,
  path: '/',
  loader: async ({ params }) => {
    const { treeId } = params;
    if (!treeId) {
      throw new Error('Missing treeId parameter');
    }

    return await loadPageNode({ treeId });
  },
  component: TreeLayoutIndexComponent,
});

function TreeLayoutIndexComponent() {
  const data = treeLayoutIndexRoute.useLoaderData() as LoadPageNodeReturn;
  return <TreeLayoutBody data={data} />;
}
