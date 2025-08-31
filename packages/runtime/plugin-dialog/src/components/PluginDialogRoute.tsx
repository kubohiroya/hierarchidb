/**
 * Plugin Dialog Route Component
 * Integrates plugin dialogs with React Router
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { NodeId, TreeId } from '@hierarchidb/common-type';
import { PluginDialog } from './PluginDialog';
import { PluginStepRegistry } from '../registry/PluginStepRegistry';


/**
 * Plugin Dialog Route Component
 * This component should be used in React Router route definitions
 */
export const PluginDialogRoute: React.FC = () => {
  const params = useParams<Record<string, string | undefined>>();
  const navigate = useNavigate();
  const registry = PluginStepRegistry.getInstance();

  // Parse params
  const treeId = params.treeId as TreeId;
  const nodeType = params.nodeType || '';
  const action = params.action as 'create' | 'edit' | undefined;
  const targetNodeId = params.targetNodeId as NodeId | undefined;
  const pageNodeId = params.pageNodeId as NodeId | undefined;


  // Parse query params for additional context
  const searchParams = new URLSearchParams(window.location.search);
  const stepParam = searchParams.get('step');
  const currentStep = stepParam ? parseInt(stepParam, 10) - 1 : 0; // Convert to 0-based index
  
  // Determine mode based on action
  // Action can be 'create', 'edit', or 'trash'
  const mode = action === 'create' ? 'create' : 'edit';
  
  // targetNodeId is the working copy ID (UUID) for both create and edit
  const workingCopyId = targetNodeId;
  const parentId = pageNodeId;

  // State
  const [isOpen, setIsOpen] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  // Validate access
  useEffect(() => {
    async function checkAccess() {
      const canAccess = await registry.validateAccess(nodeType, nodeId as string);
      setHasAccess(canAccess);
      
      if (!canAccess) {
        console.error(`Access denied for nodeType: ${nodeType}`);
        navigate(-1);
      }
    }

    if (nodeType) {
      checkAccess();
    }
  }, [nodeType, nodeId, registry, navigate]);

  // Handle close
  const handleClose = () => {
    setIsOpen(false);
    
    // Navigate back to parent node or tree
    if (parentId) {
      navigate(`/t/${treeId}/${parentId}`);
    } else {
      navigate(`/t/${treeId}`);
    }
  };

  // Handle success
  const handleSuccess = (savedNodeId: NodeId) => {
    // Navigate to the saved node
    navigate(`/t/${treeId}/${parentId}/${savedNodeId}`);
  };

  // Check if node type is registered
  const isRegistered = registry.getRegisteredNodeTypes().includes(nodeType);
  
  if (!isRegistered) {
    return (
      <div>
        Unknown node type: {nodeType}
      </div>
    );
  }

  if (hasAccess === null) {
    return <div>Checking access...</div>;
  }

  if (hasAccess === false) {
    return <div>Access denied</div>;
  }

  return (
    <PluginDialog
      mode={mode}
      nodeType={nodeType}
      nodeId={workingCopyId}
      parentId={parentId}
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