/**
 * Tree Index Route for TanStack Router
 *
 * Handles the `/t/:treeId` path (without pageNodeId) and loads the tree root node.
 */

import { createRoute } from '@tanstack/react-router';
import { treeLayoutRoute } from './layoutRoute.js';
import { loadPageNode } from '../../loaders/treeLoaders.js';
import { TreeLayoutBody } from '../t.($treeId).($pageNodeId).js';
import type { LoadPageNodeReturn } from '../../loaders/treeLoaders.js';

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
