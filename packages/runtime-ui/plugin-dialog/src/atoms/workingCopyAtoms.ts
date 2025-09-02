/**
 * Working Copy Atoms for Jotai state management
 */

import { atom } from 'jotai';
import { NodeId, TreeId } from '@hierarchidb/common-type';
import type { DialogStep } from '@hierarchidb/ui-dialog';

/**
 * Working copy data state
 */
export interface WorkingCopyData {
  nodeId: NodeId;
  treeId: TreeId;
  parentId?: NodeId;
  nodeType: string;
  name: string;
  description?: string;
  data: Record<string, any>;
  isDraft?: boolean;
  lastModified: number;
}

/**
 * Validation result from Worker
 */
export interface ValidationResult {
  stepId: string;
  isValid: boolean;
  errors?: string[];
  warnings?: string[];
  timestamp: number;
}

/**
 * Step capabilities evaluated by Worker
 */
export interface StepCapabilities {
  canNavigateTo: boolean;
  canProceedToNext: boolean;
  canBackToPrevious: boolean;
  canSave: boolean;
  canStartBatch: boolean;
}

/**
 * Dialog state
 */
export interface DialogState {
  currentStep: number;
  completedSteps: Set<number>;
  visitedSteps: Set<number>;
  isSubmitting: boolean;
  hasUnsavedChanges: boolean;
}

// ============================================================================
// Base Atoms
// ============================================================================

/**
 * Current working copy data
 * Loaded from Worker/EphemeralDB - no client-side caching needed
 */
export const workingCopyAtom = atom<WorkingCopyData | null>(null);

/**
 * Dialog navigation state
 */
export const dialogStateAtom = atom<DialogState>({
  currentStep: 0,
  completedSteps: new Set<number>(),
  visitedSteps: new Set<number>([0]),
  isSubmitting: false,
  hasUnsavedChanges: false,
});

/**
 * Validation results from Worker
 * Map from stepId to validation result
 */
export const validationResultsAtom = atom<Map<string, ValidationResult>>(
  new Map()
);

/**
 * Step capabilities for all steps
 * Map from step index to capabilities
 */
export const stepCapabilitiesAtom = atom<Map<number, StepCapabilities>>(
  new Map()
);

/**
 * Worker connection state
 */
export const workerConnectionAtom = atom<{
  isConnected: boolean;
  isLoading: boolean;
  error: Error | null;
}>({
  isConnected: false,
  isLoading: true,
  error: null,
});

// ============================================================================
// Derived Atoms
// ============================================================================

/**
 * Current step validation state
 */
export const currentStepValidationAtom = atom((get) => {
  const dialogState = get(dialogStateAtom);
  const validationResults = get(validationResultsAtom);
  const steps = get(dialogStepsAtom);
  
  const currentStep = steps[dialogState.currentStep];
  if (!currentStep) return null;
  
  return validationResults.get(currentStep.id);
});

/**
 * Current step capabilities
 */
export const currentStepCapabilitiesAtom = atom((get) => {
  const dialogState = get(dialogStateAtom);
  const capabilities = get(stepCapabilitiesAtom);
  
  return capabilities.get(dialogState.currentStep) || {
    canNavigateTo: false,
    canProceedToNext: false,
    canBackToPrevious: false,
    canSave: false,
    canStartBatch: false,
  };
});

/**
 * Dialog steps configuration
 */
export const dialogStepsAtom = atom<DialogStep[]>([]);

/**
 * Check if can save
 */
export const canSaveAtom = atom((get) => {
  const capabilities = get(currentStepCapabilitiesAtom);
  const dialogState = get(dialogStateAtom);
  const validationResults = get(validationResultsAtom);
  
  // Check if current step is valid
  const steps = get(dialogStepsAtom);
  const currentStep = steps[dialogState.currentStep];
  if (currentStep) {
    const validation = validationResults.get(currentStep.id);
    if (validation && !validation.isValid) {
      return false;
    }
  }
  
  // Check capabilities
  return capabilities.canSave && !dialogState.isSubmitting;
});

/**
 * Check if can start batch
 */
export const canStartBatchAtom = atom((get) => {
  const capabilities = get(currentStepCapabilitiesAtom);
  const dialogState = get(dialogStateAtom);
  
  return capabilities.canStartBatch && !dialogState.isSubmitting;
});

/**
 * Check if can navigate to next
 */
export const canGoNextAtom = atom((get) => {
  const capabilities = get(currentStepCapabilitiesAtom);
  const dialogState = get(dialogStateAtom);
  const steps = get(dialogStepsAtom);
  
  const isLastStep = dialogState.currentStep === steps.length - 1;
  
  return !isLastStep && capabilities.canProceedToNext && !dialogState.isSubmitting;
});

/**
 * Check if can navigate to previous
 */
export const canGoPreviousAtom = atom((get) => {
  const capabilities = get(currentStepCapabilitiesAtom);
  const dialogState = get(dialogStateAtom);
  
  return dialogState.currentStep > 0 && 
         capabilities.canBackToPrevious && 
         !dialogState.isSubmitting;
});

// ============================================================================
// Write Atoms (Actions)
// ============================================================================

/**
 * Update working copy data
 */
export const updateWorkingCopyAtom = atom(
  null,
  (get, set, update: Partial<WorkingCopyData>) => {
    const current = get(workingCopyAtom);
    if (!current) return;
    
    set(workingCopyAtom, {
      ...current,
      ...update,
      lastModified: Date.now(),
    });
    
    // Mark as having unsaved changes
    set(dialogStateAtom, (prev: DialogState) => ({
      ...prev,
      hasUnsavedChanges: true,
    }));
  }
);

/**
 * Update dialog state
 */
export const updateDialogStateAtom = atom(
  null,
  (_get, set, update: Partial<DialogState>) => {
    set(dialogStateAtom, (prev: DialogState) => ({
      ...prev,
      ...update,
    }));
  }
);

/**
 * Set validation result for a step
 */
export const setValidationResultAtom = atom(
  null,
  (get, set, stepId: string, result: Omit<ValidationResult, 'stepId' | 'timestamp'>) => {
    const results = new Map(get(validationResultsAtom));
    results.set(stepId, {
      stepId,
      ...result,
      timestamp: Date.now(),
    });
    set(validationResultsAtom, results);
  }
);

/**
 * Set capabilities for a step
 */
export const setStepCapabilitiesAtom = atom(
  null,
  (get, set, stepIndex: number, capabilities: StepCapabilities) => {
    const caps = new Map(get(stepCapabilitiesAtom));
    caps.set(stepIndex, capabilities);
    set(stepCapabilitiesAtom, caps);
  }
);

/**
 * Navigate to step
 */
export const navigateToStepAtom = atom(
  null,
  (get, set, stepIndex: number) => {
    const dialogState = get(dialogStateAtom);
    const visitedSteps = new Set(dialogState.visitedSteps);
    visitedSteps.add(stepIndex);
    
    set(dialogStateAtom, {
      ...dialogState,
      currentStep: stepIndex,
      visitedSteps,
    });
  }
);

/**
 * Mark step as completed
 */
export const markStepCompletedAtom = atom(
  null,
  (get, set, stepIndex: number) => {
    const dialogState = get(dialogStateAtom);
    const completedSteps = new Set(dialogState.completedSteps);
    completedSteps.add(stepIndex);
    
    set(dialogStateAtom, {
      ...dialogState,
      completedSteps,
    });
  }
);

/**
 * Reset dialog state
 */
export const resetDialogAtom = atom(
  null,
  (_get, set) => {
    set(workingCopyAtom, null);
    set(dialogStateAtom, {
      currentStep: 0,
      completedSteps: new Set<number>(),
      visitedSteps: new Set<number>([0]),
      isSubmitting: false,
      hasUnsavedChanges: false,
    });
    set(validationResultsAtom, new Map());
    set(stepCapabilitiesAtom, new Map());
  }
);
