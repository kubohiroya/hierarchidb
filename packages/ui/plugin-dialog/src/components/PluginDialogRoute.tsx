/**
 * Plugin Dialog Route Component
 * Integrates plugin dialogs with React Router
 */

import React from 'react';
import { useLoaderData, useNavigate, useLocation } from '@tanstack/react-router';
import { NodeId, TreeId } from '@hierarchidb/common-types';
import { PluginDialogShell } from '../headless/PluginDialogShell.js';
import { getWorkerClientHook } from '@hierarchidb/runtime-worker-bootstrap';

interface PluginDialogLoaderData {
  tree: { id: TreeId };
  pageNodeId: NodeId;
  targetNodeId: NodeId;
  targetNode?: unknown;
  nodeType: string;
  action: string;
}

/**
 * Plugin Dialog Route Component
 * This component should be used in React Router route definitions
 */

export interface PluginDialogRouteProps {
  loaderData?: PluginDialogLoaderData;
}

const PluginDialogRouteBody: React.FC<{ data: PluginDialogLoaderData }> = ({ data }) => {
  const { tree, pageNodeId, targetNodeId, nodeType, action } = data;

  const navigate = useNavigate();
  const location = useLocation();
  const useWorkerHook = getWorkerClientHook() ?? (() => null);
  const ref = useWorkerHook();
  const client = ref?.client ?? null;

  // Parse query params for additional context
  const searchParams = new URLSearchParams(location.searchStr ? location.searchStr.slice(1) : '');
  const stepParam = searchParams.get('step');
  const currentStep = stepParam ? parseInt(stepParam, 10) - 1 : 0; // Convert to 0-based index

  // Determine mode based on action with guard:
  // If action=create but target node already exists (canonical), treat as edit.
  const mode: 'create' | 'edit' = action === 'create' ? 'create' : 'edit';

  // targetNodeId is the working copy ID (UUID) for both create and edit
  const workingCopyId = targetNodeId;

  // State
  const [isOpen, setIsOpen] = React.useState(true);

  // Ensure edit mode uses a working copy node id in the URL
  React.useEffect(() => {
    let disposed = false;
    (async () => {
      if (!client) return;
      if (mode !== 'edit') return;
      try {
        const query = await client.getQueryAPI();
        const wcApi = await client.getWorkingCopyAPI();
        // If current target is already a WC (its parent is a WC holder), do nothing
        const node = await query.getNode(targetNodeId);
        if (node) {
          const parent = node.parentId ? await query.getNode(node.parentId) : null;
          if (parent?.holderType === 'workingCopy') return;
        }
        // Treat targetNodeId as canonical id; find or create WC and redirect
        const existing = await wcApi.getWorkingCopy(targetNodeId);
        const wc = existing ?? (await (async () => {
          await wcApi.createWorkingCopyFromNode(targetNodeId);
          return await wcApi.getWorkingCopy(targetNodeId);
        })());
        if (!disposed && wc?.id && wc.id !== targetNodeId) {
          const search = location.searchStr || '';
          const hash = location.hash || '';
          void navigate({
            to: `/t/${tree.id}/${pageNodeId}/${wc.id}/${nodeType}/${action}${search}${hash}`,
            replace: true,
          });
        }
      } catch (e) {
        console.warn('[PluginDialogRoute] ensure working copy for edit failed', e);
      }
    })();
    return () => { disposed = true; };
  }, [client, mode, targetNodeId, tree?.id, pageNodeId, nodeType, action, navigate, location.searchStr, location.hash]);


  // Handle close
  const handleClose = () => {
    setIsOpen(false);
    const destination = pageNodeId ? `/t/${tree.id}/${pageNodeId}` : `/t/${tree.id}`;
    void navigate({ to: destination });
  };

  // Handle success
  const handleSuccess = (savedNodeId: NodeId) => {
    // Navigate to the saved node
    void navigate({ to: `/t/${tree.id}/${pageNodeId}/${savedNodeId}` });
  };

  // Unified host: headless plugin dialog shell
  return (
    <PluginDialogShell
      mode={mode}
      nodeType={nodeType}
      nodeId={workingCopyId}
      pageNodeId={pageNodeId}
      treeId={tree.id}
      open={isOpen}
      onClose={handleClose}
      onSuccess={handleSuccess}
      initialStep={currentStep}
    />
  );
};

const PluginDialogRouteFromRouter: React.FC = () => {
  const data = useLoaderData({ from: '/t/$treeId/$pageNodeId/$targetNodeId/$nodeType/$action' }) as PluginDialogLoaderData;
  return <PluginDialogRouteBody data={data} />;
};

export const PluginDialogRoute: React.FC<PluginDialogRouteProps> = ({ loaderData }) => {
  if (loaderData) {
    return <PluginDialogRouteBody data={loaderData} />;
  }
  return <PluginDialogRouteFromRouter />;
};

/**
 * Create route configuration for plugin dialogs
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
