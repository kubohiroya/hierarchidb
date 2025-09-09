/**
 * Plugin Dialog Component
 * Integrates plugin-provided steps with MultiStepDialog
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DialogStep, MultiStepDialog } from '@hierarchidb/ui-dialog';
import { NodeId, TreeId } from '@hierarchidb/common-type';
import { PluginStepRegistry } from '../registry/PluginStepRegistry';
import { useWorkingCopy } from '../hooks/useWorkingCopy';
import { BasicInfoStep } from './steps/BasicInfoStep';

export interface PluginDialogProps {
  /** Dialog mode */
  mode: 'create' | 'edit';

  /** Node type */
  nodeType: string;

  /** Node ID (working copy ID) */
  nodeId?: NodeId;

  /** Parent node ID (for create mode) */
  parentId?: NodeId;

  /** Tree ID */
  treeId: TreeId;

  /** Dialog open state */
  open: boolean;

  /** Initial step to display */
  initialStep?: number;

  /** Close handler */
  onClose: () => void;

  /** Success handler */
  onSuccess?: (nodeId: NodeId) => void;
}

/**
 * Plugin Dialog Component
 */
export const PluginDialog: React.FC<PluginDialogProps> = ({
                                                            mode,
                                                            nodeType,
                                                            nodeId,
                                                            parentId,
                                                            treeId,
                                                            open,
                                                            initialStep = 0,
                                                            onClose,
                                                            onSuccess,
                                                          }) => {
  const navigate = useNavigate();
  const registry = PluginStepRegistry.getInstance();

  // Working copy management
  const {
    workingCopy,
    hasUnsavedChanges,
    saveWorkingCopy,
    saveDraft,
    discardWorkingCopy,
    loading,
    error,
  } = useWorkingCopy({
    mode,
    nodeType,
    nodeId,
    parentId,
    treeId,
  });

  // State
  const [activeStep, setActiveStep] = useState(initialStep);
  const [basicInfo, setBasicInfo] = useState({
    name: '',
    description: '',
  });

  // Get plugin steps
  const pluginSteps = useMemo(() => {
    if (mode === 'create') {
      return registry.getCreateSteps(nodeType);
    } else if (mode === 'edit' && nodeId) {
      return registry.getEditSteps(nodeType, nodeId as string, workingCopy?.data);
    }
    return [];
  }, [mode, nodeType, nodeId, workingCopy, registry]);

  // Build complete steps array
  const steps: DialogStep[] = useMemo(() => {
    // Always start with basic info step
    const basicStep: DialogStep = {
      id: 'basic-info',
      label: 'Basic Information',
      component: (
        <BasicInfoStep
          name={basicInfo.name}
          description={basicInfo.description}
          onChange={setBasicInfo}
          mode={mode}
        />
      ),
      validate: () => {
        return basicInfo.name.trim().length > 0;
      },
    };

    // Add plugin-provided steps
    return [basicStep, ...pluginSteps];
  }, [basicInfo, mode, pluginSteps]);

  // Load data for edit mode
  useEffect(() => {
    if (mode === 'edit' && workingCopy) {
      setBasicInfo({
        name: workingCopy.name || '',
        description: workingCopy.description || '',
      });
    }
  }, [mode, workingCopy]);

  // Get dialog title
  const dialogTitle = useMemo(() => {
    const provider = registry.getProvider(nodeType);
    const typeName = provider ? nodeType : 'Node';
    return mode === 'create' ? `Create ${typeName}` : `Edit ${typeName}`;
  }, [mode, nodeType, registry]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    try {
      // Combine basic info with working copy data
      const finalData = {
        ...workingCopy,
        name: basicInfo.name,
        description: basicInfo.description,
      };

      // Save the working copy
      const savedNodeId = await saveWorkingCopy(finalData);

      // Navigate to the new/updated node
      if (savedNodeId) {
        onSuccess?.(savedNodeId);

        // Update URL to reflect the saved node
        if (mode === 'create') {
          navigate(`/t/${treeId}/${parentId}/${savedNodeId}`);
        }
      }

      onClose();
    } catch (error) {
      console.error('Failed to save:', error);
      throw error;
    }
  }, [workingCopy, basicInfo, saveWorkingCopy, onSuccess, onClose, mode, navigate, treeId, parentId]);

  // Handle save draft
  const handleSaveDraft = useCallback(async () => {
    try {
      const draftData = {
        ...workingCopy,
        name: basicInfo.name,
        description: basicInfo.description,
        isDraft: true,
      };

      await saveDraft(draftData);
      onClose();
    } catch (error) {
      console.error('Failed to save draft:', error);
      throw error;
    }
  }, [workingCopy, basicInfo, saveDraft, onClose]);

  // Handle cancel
  const handleCancel = useCallback(async () => {
    if (hasUnsavedChanges) {
      // Will be handled by MultiStepDialog's unsaved changes dialog
      await discardWorkingCopy();
    }
    onClose();
  }, [hasUnsavedChanges, discardWorkingCopy, onClose]);

  // Handle step change
  const handleStepChange = useCallback((step: number) => {
    setActiveStep(step);

    // Update URL to reflect current step
    const stepId = steps[step]?.id;
    if (stepId) {
      const basePath = mode === 'create'
        ? `/t/${treeId}/${parentId}/new/${nodeType}`
        : `/t/${treeId}/${parentId}/${nodeId}/${nodeType}`;
      navigate(`${basePath}/${stepId}`, { replace: true });
    }
  }, [steps, mode, treeId, parentId, nodeId, nodeType, navigate]);

  // Error handling
  if (error) {
    return (
      <div>
        Error loading dialog: {error.message}
      </div>
    );
  }

  return (
    <MultiStepDialog
      open={open}
      mode={mode}
      title={dialogTitle}
      subtitle={mode === 'edit' ? `ID: ${nodeId}` : undefined}
      steps={steps}
      activeStep={activeStep}
      onStepChange={handleStepChange}
      nonLinear={true}
      hasUnsavedChanges={hasUnsavedChanges}
      supportsDraft={true}
      loading={loading}
      onSubmit={handleSubmit}
      onSaveDraft={handleSaveDraft}
      onCancel={handleCancel}
      onClose={onClose}
    />
  );
};