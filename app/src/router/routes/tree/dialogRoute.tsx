/**
 * console Dialog Route for TanStack Router
 *
 * This route handles the `/t/:treeId/:pageNodeId/:targetNodeId/:nodeType/:action` path
 * and displays the appropriate dialog component.
 * Corresponds to React Router route `t.($treeId).($pageNodeId).($targetNodeId).$nodeType.$action.tsx`
 */

import { createRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import type { TrashDialogData, TrashDialogRouteParams } from '~/router/pages/tree/trash/TrashDialog.js';
import { type LoadNodeActionReturn, loadNodeAction } from '../../loaders/treeLoaders.js';
import { treeNodeTypeRoute } from './nodeTypeRoute.js';
import { type PluginDialogLoaderData, PluginDialogRoute } from './PluginDialogRoute.js';

type TreeDialogLoaderResult =
  | {
      kind: 'trash';
      data: TrashDialogData;
      params: TrashDialogRouteParams;
    }
  | {
      kind: 'plugin';
      data: PluginDialogLoaderData;
    };

const TrashDialogLazy = lazy(() => import('~/router/pages/tree/trash/TrashDialog.js'));

export const treeDialogRoute = createRoute({
  getParentRoute: () => treeNodeTypeRoute,
  path: '$action',
  loader: async ({ params }) => {
    const { treeId, pageNodeId, targetNodeId, nodeType, action } = params;
    if (!treeId || !targetNodeId || !nodeType || !action) {
      throw new Error('Missing required parameters');
    }
    const resolvedPageNodeId = pageNodeId ?? `${treeId}:root`;

    const resolvedParams: TreeDialogResolvedParams = {
      treeId,
      pageNodeId: resolvedPageNodeId,
      targetNodeId,
      nodeType,
      action,
    };

    // Special handling for trash dialog
    if (nodeType === 'trash') {
      const trashDialogModule = await import('~/router/pages/tree/trash/TrashDialog.js');
      if (trashDialogModule.clientLoader) {
        const trashParams = toTrashDialogParams(resolvedParams);
        const data = await trashDialogModule.clientLoader({ params: trashParams });
        return {
          kind: 'trash',
          data,
          params: trashParams,
        } satisfies TreeDialogLoaderResult;
      }
    }

    const pluginData = await loadNodeAction({
      treeId,
      pageNodeId: resolvedPageNodeId,
      targetNodeId,
      nodeType,
      action,
    });

    return {
      kind: 'plugin',
      data: toPluginDialogLoaderData(pluginData, resolvedParams),
    } satisfies TreeDialogLoaderResult;
  },
  component: TreeDialogGuarded,
});

function TreeDialogGuarded() {
  const loaderResult = treeDialogRoute.useLoaderData() as TreeDialogLoaderResult;

  if (loaderResult.kind === 'trash') {
    const { data, params } = loaderResult;
    return (
      <Suspense fallback={null}>
        <TrashDialogLazy data={data} params={params} />
      </Suspense>
    );
  }

  if (loaderResult.kind === 'plugin') {
    return <PluginDialogRoute loaderData={loaderResult.data} />;
  }

  return null;
}

type TreeDialogResolvedParams = {
  treeId: string;
  pageNodeId: string;
  targetNodeId: string;
  nodeType: string;
  action: string;
};

function toTrashDialogParams(params: TreeDialogResolvedParams): TrashDialogRouteParams {
  return {
    treeId: params.treeId,
    pageNodeId: params.pageNodeId,
    targetNodeId: params.targetNodeId,
    nodeType: params.nodeType,
    action: params.action,
  };
}

function toPluginDialogLoaderData(
  loaderData: LoadNodeActionReturn,
  params: TreeDialogResolvedParams
): PluginDialogLoaderData {
  return {
    ...loaderData,
    params,
  };
}
