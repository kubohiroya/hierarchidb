/**
 * Plugin Dialog Route Component
 * Integrates plugin dialogs with React Router
 */

import React from 'react';
import { useLoaderData, useNavigate } from 'react-router-dom';
import { NodeId } from '@hierarchidb/common-type';
import { PluginDialog } from './PluginDialog';
import { getWorkerClientHook } from '@hierarchidb/runtime-worker-bootstrap';

/**
 * Plugin Dialog Route Component
 * This component should be used in React Router route definitions
 */

export const PluginDialogRoute: React.FC = () => {

  const { tree, pageNodeId, targetNodeId, targetNode, nodeType, action } = useLoaderData() as any;

  const navigate = useNavigate();
  const useWorkerHook = (getWorkerClientHook<any>() || (() => null));
  const client = useWorkerHook()?.client ?? null;

  // Parse query params for additional context
  const searchParams = new URLSearchParams(window.location.search);
  const stepParam = searchParams.get('step');
  const currentStep = stepParam ? parseInt(stepParam, 10) - 1 : 0; // Convert to 0-based index

  // Determine mode based on action with guard:
  // If action=create but target node already exists (canonical), treat as edit.
  const mode: 'create' | 'edit' = action === 'create' && !targetNode ? 'create' : 'edit';

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
          if ((parent as any)?.holderType === 'workingCopy') return;
        }
        // Treat targetNodeId as canonical id; find or create WC and redirect
        const existing = await wcApi.getWorkingCopy(targetNodeId);
        const wc = existing ?? (await (async () => {
          await wcApi.createWorkingCopyFromNode(targetNodeId);
          return await wcApi.getWorkingCopy(targetNodeId);
        })());
        if (!disposed && wc?.id && wc.id !== targetNodeId) {
          const search = window.location.search || '';
          navigate(`/t/${tree.id}/${pageNodeId}/${wc.id}/${nodeType}/${action}${search}`, { replace: true });
        }
      } catch (e) {
        console.warn('[PluginDialogRoute] ensure working copy for edit failed', e);
      }
    })();
    return () => { disposed = true; };
  }, [client, mode, targetNodeId, tree?.id, pageNodeId, nodeType, action, navigate]);


  // Handle close
  const handleClose = () => {
    setIsOpen(false);
    if (pageNodeId) {
      navigate(`/t/${tree.id}/${pageNodeId}`);
    } else {
      navigate(`/t/${tree.id}`);
    }
  };

  // Handle success
  const handleSuccess = (savedNodeId: NodeId) => {
    // Navigate to the saved node
    navigate(`/t/${tree.id}/${pageNodeId}/${savedNodeId}`);
  };

  // Unified host: generic PluginDialog with Basic Info + registry-provided steps (if any)
  return (
    <PluginDialog
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
