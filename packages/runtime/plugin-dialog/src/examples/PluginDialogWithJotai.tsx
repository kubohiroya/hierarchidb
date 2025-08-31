/**
 * Example: Plugin Dialog with Jotai state management
 */

import React, { useEffect } from 'react';
import { Provider, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { MultiStepDialogEnhanced } from '@hierarchidb/ui-dialog';
import { NodeId, TreeId } from '@hierarchidb/common-type';
import {
  workingCopyAtom,
  dialogStateAtom,
  dialogStepsAtom,
  canGoNextAtom,
  canGoPreviousAtom,
  canSaveAtom,
  canStartBatchAtom,
  navigateToStepAtom,
  markStepCompletedAtom,
  updateWorkingCopyAtom,
  currentStepValidationAtom,
  resetDialogAtom,
} from '../atoms/workingCopyAtoms';
import { useWorkerSync } from '../hooks/useWorkerSync';
import { PluginStepRegistry } from '../registry/PluginStepRegistry';

interface PluginDialogProps {
  nodeId: NodeId;
  treeId: TreeId;
  nodeType: string;
  mode: 'create' | 'edit';
  open: boolean;
  onClose: () => void;
  onSuccess?: (nodeId: NodeId) => void;
}

/**
 * Plugin Dialog Component with Jotai
 */
function PluginDialogContent({
  nodeId,
  treeId,
  nodeType,
  mode,
  open,
  onClose,
  onSuccess,
}: PluginDialogProps) {
  // Jotai atoms
  const [workingCopy] = useAtom(workingCopyAtom);
  const [dialogState, setDialogState] = useAtom(dialogStateAtom);
  const [steps, setSteps] = useAtom(dialogStepsAtom);
  const canGoNext = useAtomValue(canGoNextAtom);
  const canGoPrevious = useAtomValue(canGoPreviousAtom);
  const canSave = useAtomValue(canSaveAtom);
  const canStartBatch = useAtomValue(canStartBatchAtom);
  const currentValidation = useAtomValue(currentStepValidationAtom);
  const navigateToStep = useSetAtom(navigateToStepAtom);
  const markStepCompleted = useSetAtom(markStepCompletedAtom);
  const updateWorkingCopy = useSetAtom(updateWorkingCopyAtom);
  const resetDialog = useSetAtom(resetDialogAtom);

  // Worker sync
  const {
    isConnected,
    isLoading,
    connectionError,
    loadWorkingCopy,
    saveWorkingCopy,
    syncWorkingCopy,
    discardWorkingCopy,
    startBatch,
  } = useWorkerSync({
    nodeId,
    nodeType,
    enabled: open,
  });

  // Load plugin steps
  useEffect(() => {
    const registry = PluginStepRegistry.getInstance();
    const provider = registry.getProvider(nodeType);
    
    if (provider) {
      const pluginSteps = mode === 'create'
        ? provider.getCreateSteps()
        : provider.getEditSteps(nodeId as string, workingCopy?.data);
      
      setSteps(pluginSteps);
    }
  }, [nodeType, mode, nodeId, workingCopy, setSteps]);

  // Load working copy on mount
  useEffect(() => {
    if (!open || !isConnected) return;

    if (mode === 'edit') {
      loadWorkingCopy().catch(console.error);
    } else {
      // Initialize new working copy
      updateWorkingCopy({
        nodeId,
        treeId,
        nodeType,
        name: '',
        description: '',
        data: {},
        lastModified: Date.now(),
      });
    }
  }, [open, isConnected, mode, nodeId, treeId, nodeType, loadWorkingCopy, updateWorkingCopy]);

  // Handle step navigation
  const handleStepChange = (newStep: number) => {
    // Mark current step as completed if moving forward
    if (newStep > dialogState.currentStep) {
      markStepCompleted(dialogState.currentStep);
    }
    
    navigateToStep(newStep);
  };

  // Handle data changes
  const handleDataChange = (updates: any) => {
    syncWorkingCopy(updates);
  };

  // Handle save
  const handleSave = async () => {
    setDialogState({ ...dialogState, isSubmitting: true });
    
    try {
      const savedId = await saveWorkingCopy(false);
      onSuccess?.(savedId);
      resetDialog();
      onClose();
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setDialogState({ ...dialogState, isSubmitting: false });
    }
  };

  // Handle save as draft
  const handleSaveDraft = async () => {
    setDialogState({ ...dialogState, isSubmitting: true });
    
    try {
      await saveWorkingCopy(true);
      resetDialog();
      onClose();
    } catch (error) {
      console.error('Save draft failed:', error);
    } finally {
      setDialogState({ ...dialogState, isSubmitting: false });
    }
  };

  // Handle batch start
  const handleStartBatch = async () => {
    if (!workingCopy) return;
    
    setDialogState({ ...dialogState, isSubmitting: true });
    
    try {
      await startBatch(workingCopy.data.batchConfig);
      onSuccess?.(nodeId);
      resetDialog();
      onClose();
    } catch (error) {
      console.error('Batch start failed:', error);
    } finally {
      setDialogState({ ...dialogState, isSubmitting: false });
    }
  };

  // Handle cancel
  const handleCancel = async () => {
    if (dialogState.hasUnsavedChanges) {
      // Show unsaved changes dialog
      const confirmed = window.confirm('Discard unsaved changes?');
      if (!confirmed) return;
      
      await discardWorkingCopy();
    }
    
    resetDialog();
    onClose();
  };

  // Show loading state
  if (isLoading) {
    return <div>Loading Worker...</div>;
  }

  // Show error state
  if (connectionError) {
    return <div>Worker connection error: {connectionError.message}</div>;
  }

  // Show validation errors
  const validationErrors = currentValidation?.errors || [];

  return (
    <MultiStepDialogEnhanced
      open={open}
      mode={mode}
      title={`${mode === 'create' ? 'Create' : 'Edit'} ${nodeType}`}
      subtitle={mode === 'edit' ? `ID: ${nodeId}` : undefined}
      steps={steps.map((step, index) => ({
        ...step,
        component: (
          <div>
            {step.component}
            {/* Show validation errors for current step */}
            {index === dialogState.currentStep && validationErrors.length > 0 && (
              <div style={{ color: 'red', marginTop: 16 }}>
                {validationErrors.map((error, i) => (
                  <div key={i}>• {error}</div>
                ))}
              </div>
            )}
          </div>
        ),
      }))}
      activeStep={dialogState.currentStep}
      onStepChange={handleStepChange}
      nonLinear={true}
      hasUnsavedChanges={dialogState.hasUnsavedChanges}
      supportsDraft={true}
      loading={dialogState.isSubmitting}
      currentData={workingCopy?.data || {}}
      onDataChange={handleDataChange}
      onSubmit={canStartBatch ? handleStartBatch : handleSave}
      onSaveDraft={handleSaveDraft}
      onCancel={handleCancel}
      onClose={onClose}
      submitText={canStartBatch ? 'Start Batch' : (mode === 'create' ? 'Create' : 'Save')}
    />
  );
}

/**
 * Plugin Dialog with Jotai Provider
 */
export function PluginDialogWithJotai(props: PluginDialogProps) {
  return (
    <Provider>
      <PluginDialogContent {...props} />
    </Provider>
  );
}