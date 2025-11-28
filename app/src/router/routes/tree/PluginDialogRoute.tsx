/**
 * Plugin Dialog Route Component
 * Integrates plugin console with React Router
 */

import { NodeAction, type NodeId, type TreeId } from '@hierarchidb/common-types';
import { getWorkerClientHook } from '@hierarchidb/ui-worker-provider';
import { PluginDialogHost } from '@hierarchidb/ui-plugin-shell/plugin-ui-host';
import { useLoaderData, useLocation, useNavigate } from '@tanstack/react-router';
import React from 'react';
import type { LoadNodeActionReturn } from '../../loaders/treeLoaders.js';

type TreeDialogRouteParams = {
  treeId: string;
  pageNodeId?: string;
  targetNodeId: string;
  nodeType: string;
  action: string;
};

export interface PluginDialogLoaderData extends LoadNodeActionReturn {
  params: TreeDialogRouteParams;
}

/**
 * Plugin Dialog Route Component
 * This component should be used in React Router route definitions
 */

export interface PluginDialogRouteProps {
  loaderData?: PluginDialogLoaderData;
}

const PluginDialogRouteBody: React.FC<{ data: PluginDialogLoaderData }> = ({ data }) => {
  const { tree, pageNodeId, targetNodeId, nodeType, action, params } = data;

  const navigate = useNavigate();
  const location = useLocation();
  // State
  const [isOpen, setIsOpen] = React.useState(true);

  const useWorkerHook = getWorkerClientHook() ?? (() => null);

  const treeId: TreeId | undefined = tree?.id ?? (params.treeId as TreeId | undefined);
  const effectiveTargetNodeId: NodeId | undefined =
    targetNodeId ?? (params.targetNodeId as NodeId | undefined);
  const effectivePageNodeId: NodeId | undefined =
    pageNodeId ??
    (params.pageNodeId as NodeId | undefined) ??
    (treeId ? (`${treeId}:root` as NodeId) : undefined);
  const effectiveNodeType: string | undefined = nodeType ?? params.nodeType;
  const effectiveAction: NodeAction | undefined = action ?? toNodeAction(params.action);

  const isReady = Boolean(
    treeId && effectiveTargetNodeId && effectivePageNodeId && effectiveNodeType && effectiveAction
  );

  // Parse query params for additional context
  const searchParams = new URLSearchParams(location.searchStr ? location.searchStr.slice(1) : '');
  const stepParam = searchParams.get('step');
  const currentStep = stepParam ? parseInt(stepParam, 10) - 1 : 0; // Convert to 0-based index

  // Determine mode based on action with guard:
  // If action=create but target node already exists (canonical), treat as edit.
  const requestedAction = params.action?.toLowerCase() ?? '';
  const mode: 'create' | 'edit' =
    requestedAction === 'edit' || effectiveAction === NodeAction.UPDATE ? 'edit' : 'create';

  if (!isReady) {
    console.warn('[PluginDialogRoute] Missing required data to render plugin dialog', {
      treeId,
      effectiveTargetNodeId,
      effectivePageNodeId,
      effectiveNodeType,
      effectiveAction,
    });
    return null;
  }

  const resolvedTreeId = treeId as TreeId;
  const resolvedTargetNodeId = effectiveTargetNodeId as NodeId;
  const resolvedPageNodeId = effectivePageNodeId as NodeId;
  const resolvedNodeType = effectiveNodeType as string;

  // Handle close
  const handleClose = () => {
    setIsOpen(false);
    const destination = resolvedPageNodeId
      ? `/t/${resolvedTreeId}/${resolvedPageNodeId}`
      : `/t/${resolvedTreeId}`;
    void navigate({ to: destination });
  };

  // Handle success
  const handleSuccess = (savedNodeId: NodeId) => {
    // Navigate to the saved node
    void navigate({ to: `/t/${resolvedTreeId}/${resolvedPageNodeId}/${savedNodeId}` });
  };

  // Unified host: headless plugin dialog shell
  return (
    <PluginDialogHost
      mode={mode}
      nodeType={resolvedNodeType}
      nodeId={resolvedTargetNodeId}
      pageNodeId={resolvedPageNodeId}
      treeId={resolvedTreeId}
      open={isOpen}
      onClose={handleClose}
      onSuccess={handleSuccess}
      initialStep={currentStep}
    />
  );
};

const PluginDialogRouteFromRouter: React.FC = () => {
  const candidate = useLoaderData({
    from: '/t/$treeId/$pageNodeId/$targetNodeId/$nodeType/$action',
  }) as
    | PluginDialogLoaderData
    | { kind: 'trash'; data: unknown }
    | { kind: 'plugin'; data: PluginDialogLoaderData };
  if (typeof candidate === 'object' && candidate !== null && 'kind' in candidate) {
    if (candidate.kind === 'plugin') {
      return <PluginDialogRouteBody data={candidate.data} />;
    }
    return null;
  }
  return <PluginDialogRouteBody data={candidate} />;
};

export const PluginDialogRoute: React.FC<PluginDialogRouteProps> = ({ loaderData }) => {
  if (loaderData) {
    return <PluginDialogRouteBody data={loaderData} />;
  }
  return <PluginDialogRouteFromRouter />;
};

/**
 * Create route configuration for plugin console
 * Uses the existing route pattern: /t/:treeId/:pageNodeId/:targetNodeId/:nodeType/:action
 */
export function createPluginDialogRoutes() {
  return [
    // Standard route pattern with action
    {
      path: 't/:treeId/:pageNodeId/:targetNodeId/:nodeType/:action',
      element: <PluginDialogRoute />,
    },
  ];
}

function toNodeAction(value: string | undefined): NodeAction | undefined {
  switch (value) {
    case NodeAction.CREATE:
    case NodeAction.UPDATE:
    case NodeAction.DELETE:
    case NodeAction.MOVE:
    case NodeAction.DUPLICATE:
    case NodeAction.IMPORT:
    case NodeAction.EXPORT:
    case NodeAction.RESTORE:
    case NodeAction.DISCARD:
      return value;
    case 'edit':
      return NodeAction.UPDATE;
    default:
      return undefined;
  }
}
