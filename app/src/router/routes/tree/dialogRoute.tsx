/**
 * console Dialog Route for TanStack Router
 *
 * This route handles the `/t/:treeId/:pageNodeId/:targetNodeId/:nodeType/:action/:mode?/:step?` path
 * and displays the appropriate dialog component.
 * Corresponds to React Router route `t.($treeId).($pageNodeId).($targetNodeId).$nodeType.$action.tsx`
 */

import type { NodeId } from '@hierarchidb/core-types';
import { createRoute } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import type {
  ArchiveDialogData,
  ArchiveDialogRouteParams,
} from '~/router/pages/tree/archive/ArchiveDialog';
import {
  type LoadNodeActionReturn,
  loadNodeAction,
  loadWorkerAPIClient,
} from '~/router/loaders/treeLoaders';
import { treeNodeTypeRoute } from './nodeTypeRoute.js';
import { PluginDialogRoute } from './PluginDialogRoute.js';
import type { PluginDialogLoaderData } from './pluginDialogRouteTypes.js';

export type TreeDialogLoaderResult =
  | {
      kind: 'archive';
      data: ArchiveDialogData;
      params: ArchiveDialogRouteParams;
    }
  | {
      kind: 'plugin';
      data: PluginDialogLoaderData;
    };

const ArchiveDialogLazy = lazy(() => import('~/router/pages/tree/archive/ArchiveDialog'));

const loadTreeDialog = async ({
  params,
}: {
  params: {
    treeId?: string;
    pageNodeId?: string;
    targetNodeId?: string;
    nodeType?: string;
    action?: string;
    mode?: string;
    step?: string;
  };
}): Promise<TreeDialogLoaderResult> => {
  const { treeId, pageNodeId, targetNodeId, nodeType, action, mode, step } = params;
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
    mode,
    step,
  };

  const normalizedNodeType = nodeType.toLowerCase();

  // Special handling for archive dialog
  if (normalizedNodeType === 'archive') {
    const archiveDialogModule = await import('~/router/pages/tree/archive/ArchiveDialog');
    if (archiveDialogModule.clientLoader) {
      const archiveParams = toArchiveDialogParams(resolvedParams);
      const data = await archiveDialogModule.clientLoader({ params: archiveParams });
      return {
        kind: 'archive',
        data,
        params: archiveParams,
      } satisfies TreeDialogLoaderResult;
    }
  }

  if (normalizedNodeType === 'folder') {
    const { client } = await loadWorkerAPIClient();
    return {
      kind: 'plugin',
      data: {
        client,
        tree: undefined,
        pageNodeId: resolvedPageNodeId as NodeId,
        pageNode: undefined,
        targetNodeId: targetNodeId as NodeId,
        targetNode: undefined,
        nodeType: undefined,
        action: undefined,
        params: resolvedParams,
      },
    } satisfies TreeDialogLoaderResult;
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
};

const renderTreeDialog = (loaderResult: TreeDialogLoaderResult) => {
  if (loaderResult.kind === 'archive') {
    const { data, params } = loaderResult;
    return (
      <Suspense fallback={null}>
        <ArchiveDialogLazy data={data} params={params} />
      </Suspense>
    );
  }

  if (loaderResult.kind === 'plugin') {
    return <PluginDialogRoute loaderData={loaderResult.data} />;
  }

  return null;
};

export const treeDialogRoute = createRoute({
  getParentRoute: () => treeNodeTypeRoute,
  path: '$action',
  loader: loadTreeDialog,
  component: () => {
    const loaderResult = treeDialogRoute.useLoaderData() as TreeDialogLoaderResult;
    return renderTreeDialog(loaderResult);
  },
});

export const treeDialogModeRoute = createRoute({
  getParentRoute: () => treeNodeTypeRoute,
  path: '$action/$mode',
  loader: loadTreeDialog,
  component: () => {
    const loaderResult = treeDialogModeRoute.useLoaderData() as TreeDialogLoaderResult;
    return renderTreeDialog(loaderResult);
  },
});

export const treeDialogModeStepRoute = createRoute({
  getParentRoute: () => treeNodeTypeRoute,
  path: '$action/$mode/$step',
  loader: loadTreeDialog,
  component: () => {
    const loaderResult = treeDialogModeStepRoute.useLoaderData() as TreeDialogLoaderResult;
    return renderTreeDialog(loaderResult);
  },
});

type TreeDialogResolvedParams = {
  treeId: string;
  pageNodeId: string;
  targetNodeId: string;
  nodeType: string;
  action: string;
  mode?: string;
  step?: string;
};

function toArchiveDialogParams(params: TreeDialogResolvedParams): ArchiveDialogRouteParams {
  return {
    treeId: params.treeId,
    pageNodeId: params.pageNodeId,
    targetNodeId: params.targetNodeId,
    nodeType: params.nodeType,
    action: params.action,
    mode: params.mode,
    step: params.step,
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
