/**
 * Plugin Dialog Route Component
 * Integrates plugin dialogs with React Router
 */

import React, { useState } from 'react';
import { useLoaderData, useNavigate } from 'react-router-dom';
import { NodeId } from '@hierarchidb/common-type';
import { PluginDialog } from './PluginDialog';

/**
 * Plugin Dialog Route Component
 * This component should be used in React Router route definitions
 */

export const PluginDialogRoute: React.FC = () => {

  const { treeId, pageNodeId, targetNodeId, nodeType, action } = useLoaderData();

  const navigate = useNavigate();

  // Parse query params for additional context
  const searchParams = new URLSearchParams(window.location.search);
  const stepParam = searchParams.get('step');
  const currentStep = stepParam ? parseInt(stepParam, 10) - 1 : 0; // Convert to 0-based index

  // Determine mode based on action
  // Action can be 'create', 'edit', or 'trash'
  const mode = action === 'create' ? 'create' : 'edit';

  // targetNodeId is the working copy ID (UUID) for both create and edit
  const workingCopyId = targetNodeId;

  // State
  const [isOpen, setIsOpen] = useState(true);


  // Handle close
  const handleClose = () => {
    setIsOpen(false);

    if (pageNodeId) {
      navigate(`/t/${treeId}/${pageNodeId}`);
    } else {
      navigate(`/t/${treeId}`);
    }
  };

  // Handle success
  const handleSuccess = (savedNodeId: NodeId) => {
    // Navigate to the saved node
    navigate(`/t/${treeId}/${pageNodeId}/${savedNodeId}`);
  };

  return (
    <PluginDialog
      mode={mode}
      nodeType={nodeType}
      nodeId={workingCopyId}
      pageNodeId={pageNodeId}
      treeId={treeId}
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
