/**
 * Atoms for Jotai state management
 */

import type { NodeId, TreeId } from '@hierarchidb/common-types';
import type { DialogStep } from '@hierarchidb/ui-dialog';
import { atom } from 'jotai';
import type { DialogViewState } from '@hierarchidb/common-types';

/**
 * Working copy data state
 */
export interface DraftData<TMetadata = unknown, TData = unknown> {
  nodeId: NodeId;
  treeId: TreeId;
  parentId?: NodeId;
  nodeType: string;
  /** Committed metadata received from worker (TreeNode metadata). */
  metadata?: TMetadata;
  /** Draft metadata being edited. */
  draftMetadata?: TMetadata;
  /** Committed node payload. */
  data?: TData;
  /** Draft node payload being edited. */
  draftData?: TData;
  /** Whether this record represents an unsaved draft. */
  isDraft?: boolean;
  /** Last modified timestamp (ms) for UI bookkeeping. */
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
 * Step state
 */
export interface StepState {
  currentStep: number;
  completedSteps: Set<number>;
  visitedSteps: Set<number>;
  isSubmitting: boolean;
  hasUnsavedChanges: boolean;
}

/**
 * Dialog-level state (layout/step/save) to keep UI concerns together.
 * Complements draftAtom (node data) and stepStateAtom (navigation),
 * and can be derived from or synced to MultiStepDialogState when needed.
 */
export type DialogViewStateAtom = DialogViewState;

// ============================================================================
// Base Atoms
// ============================================================================

/**
 * Current draft data
 * Loaded from Worker/EphemeralDB - no client-side caching needed
 */
export const draftAtom = atom<DraftData | null>(null);

/**
 * Step navigation state
 */
export const stepStateAtom = atom<StepState>({
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
export const validationResultsAtom = atom<Map<string, ValidationResult>>(new Map());

/**
 * Step capabilities for all steps
 * Map from step index to capabilities
 */
export const stepCapabilitiesAtom = atom<Map<number, StepCapabilities>>(new Map());

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
  const stepState = get(stepStateAtom);
  const validationResults = get(validationResultsAtom);
  const steps = get(dialogStepsAtom);

  const currentStep = steps[stepState.currentStep];
  if (!currentStep) return null;

  return validationResults.get(currentStep.id);
});

/**
 * Current step capabilities
 */
export const currentStepCapabilitiesAtom = atom((get) => {
  const stepState = get(stepStateAtom);
  const capabilities = get(stepCapabilitiesAtom);

  return (
    capabilities.get(stepState.currentStep) || {
      canNavigateTo: false,
      canProceedToNext: false,
      canBackToPrevious: false,
      canSave: false,
      canStartBatch: false,
    }
  );
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
  const stepState = get(stepStateAtom);
  const validationResults = get(validationResultsAtom);

  // Check if current step is valid
  const steps = get(dialogStepsAtom);
  const currentStep = steps[stepState.currentStep];
  if (currentStep) {
    const validation = validationResults.get(currentStep.id);
    if (validation && !validation.isValid) {
      return false;
    }
  }

  // Check capabilities
  return capabilities.canSave && !stepState.isSubmitting;
});

/**
 * Check if can start batch
 */
export const canStartBatchAtom = atom((get) => {
  const capabilities = get(currentStepCapabilitiesAtom);
  const stepState = get(stepStateAtom);

  return capabilities.canStartBatch && !stepState.isSubmitting;
});

/**
 * Check if can navigate to next
 */
export const canGoNextAtom = atom((get) => {
  const capabilities = get(currentStepCapabilitiesAtom);
  const stepState = get(stepStateAtom);
  const steps = get(dialogStepsAtom);

  const isLastStep = stepState.currentStep === steps.length - 1;

  return !isLastStep && capabilities.canProceedToNext && !stepState.isSubmitting;
});

/**
 * Check if can navigate to previous
 */
export const canGoPreviousAtom = atom((get) => {
  const capabilities = get(currentStepCapabilitiesAtom);
  const stepState = get(stepStateAtom);

  return stepState.currentStep > 0 && capabilities.canBackToPrevious && !stepState.isSubmitting;
});

// ============================================================================
// Write Atoms (Actions)
// ============================================================================

/**
 * Update draft data
 */
export const updateDraftAtom = atom(null, (get, set, update: Partial<DraftData>) => {
  const current = get(draftAtom);
  if (!current) return;

  set(draftAtom, {
    ...current,
    ...update,
    lastModified: Date.now(),
  });

  // Mark as having unsaved changes
  set(stepStateAtom, (prev: StepState) => ({
    ...prev,
    hasUnsavedChanges: true,
  }));
});

/**
 * Update step state
 */
export const updateStepStateAtom = atom(null, (_get, set, update: Partial<StepState>) => {
  set(stepStateAtom, (prev: StepState) => ({
    ...prev,
    ...update,
  }));
});

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
export const navigateToStepAtom = atom(null, (get, set, stepIndex: number) => {
  const stepState = get(stepStateAtom);
  const visitedSteps = new Set(stepState.visitedSteps);
  visitedSteps.add(stepIndex);

  set(stepStateAtom, {
    ...stepState,
    currentStep: stepIndex,
    visitedSteps,
  });
});

/**
 * Mark step as completed
 */
export const markStepCompletedAtom = atom(null, (get, set, stepIndex: number) => {
  const stepState = get(stepStateAtom);
  const completedSteps = new Set(stepState.completedSteps);
  completedSteps.add(stepIndex);

  set(stepStateAtom, {
    ...stepState,
    completedSteps,
  });
});

/**
 * Reset step state
 */
export const resetStepStateAtom = atom(null, (_get, set) => {
  set(draftAtom, null);
  set(stepStateAtom, {
    currentStep: 0,
    completedSteps: new Set<number>(),
    visitedSteps: new Set<number>([0]),
    isSubmitting: false,
    hasUnsavedChanges: false,
  });
  set(validationResultsAtom, new Map());
  set(stepCapabilitiesAtom, new Map());
});
