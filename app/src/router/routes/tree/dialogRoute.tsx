/**
 * Tree Dialog Route for TanStack Router
 * 
 * This route handles the `/t/:treeId/:pageNodeId/:targetNodeId/:nodeType/:action` path
 * and displays the appropriate dialog component.
 * Corresponds to React Router route `t.($treeId).($pageNodeId).($targetNodeId).$nodeType.$action.tsx`
 */

import { lazy, Suspense } from 'react';
import { createRoute } from '@tanstack/react-router';
import { treeNodeTypeRoute } from './nodeTypeRoute.js';
import { loadNodeAction } from '../../loaders/treeLoaders.js';
import { PluginDialogRoute } from '@hierarchidb/ui-plugin-dialog';
import type {
  TrashDialogData,
  TrashDialogRouteParams,
} from '~/components/dialogs/TrashDialog.js';

const TrashDialogLazy = lazy(() => import('~/components/dialogs/TrashDialog.js'));

export const treeDialogRoute = createRoute({
  getParentRoute: () => treeNodeTypeRoute,
  path: '$action',
  loader: async ({ params }) => {
    const { treeId, pageNodeId, targetNodeId, nodeType, action } = params;
    if (!treeId || !targetNodeId || !nodeType || !action) {
      throw new Error('Missing required parameters');
    }
    const resolvedPageNodeId = (pageNodeId ?? `${treeId}:root`);
    
    // Special handling for trash dialog
    if (nodeType === 'trash') {
      const trashDialogModule = await import('~/components/dialogs/TrashDialog.js');
      if (trashDialogModule.clientLoader) {
        return await trashDialogModule.clientLoader({ params });
      }
    }
    
    return await loadNodeAction({
      treeId,
      pageNodeId: resolvedPageNodeId as any,
      targetNodeId,
      nodeType,
      action,
    });
  },
  component: TreeDialogGuarded,
});

function TreeDialogGuarded() {
  const params = treeDialogRoute.useParams() as TrashDialogRouteParams;
  const { nodeType, action } = params;

  if (nodeType === 'trash') {
    if (!action) return null;
    const data = treeDialogRoute.useLoaderData() as TrashDialogData;
    return (
      <Suspense fallback={null}>
        <TrashDialogLazy data={data} params={params} />
      </Suspense>
    );
  }
  
  if (!nodeType || !action) return null;
  return <PluginDialogRoute />;
}
