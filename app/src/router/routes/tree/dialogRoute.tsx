/**
 * Tree Dialog Route for TanStack Router
 * 
 * This route handles the `/t/:treeId/:pageNodeId/:targetNodeId/:nodeType/:action` path
 * and displays the appropriate dialog component.
 * Corresponds to React Router route `t.($treeId).($pageNodeId).($targetNodeId).$nodeType.$action.tsx`
 */

import { createRoute, useParams } from '@tanstack/react-router';
import { treeNodeTypeRoute } from './nodeTypeRoute.js';
import { loadNodeAction } from '../../loaders/treeLoaders.js';
import { PluginDialogRoute } from '@hierarchidb/runtime-ui-plugin-dialog';
import TrashDialog from '~/components/dialogs/TrashDialog.js';

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
      // Import the trash dialog loader
      const trashDialogModule = await import('~/components/dialogs/TrashDialog.js');
      if (trashDialogModule.clientLoader) {
        return await trashDialogModule.clientLoader({ params } as any);
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
  const { nodeType, action } = useParams({ from: treeDialogRoute.id });
  
  if (nodeType === 'trash') {
    if (!action) return null;
    return <TrashDialog />;
  }
  
  if (!nodeType || !action) return null;
  return <PluginDialogRoute />;
}
