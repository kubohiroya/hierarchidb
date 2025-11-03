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
import { loadNodeAction, type LoadNodeActionReturn } from '../../loaders/treeLoaders.js';
import { PluginDialogRoute, type PluginDialogLoaderData } from './PluginDialogRoute.js';
import type {
  TrashDialogData,
  TrashDialogRouteParams,
} from '~/components/dialogs/TrashDialog.js';

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

const TrashDialogLazy = lazy(() => import('~/components/dialogs/TrashDialog.js'));

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
      const trashDialogModule = await import('~/components/dialogs/TrashDialog.js');
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
  params: TreeDialogResolvedParams,
): PluginDialogLoaderData {
  return {
    ...loaderData,
    params,
  };
}
