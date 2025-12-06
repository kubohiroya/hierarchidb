import type { NodeId } from './id-types.js';

// Minimal dialog layout/display contracts (duplicated to avoid UI package dependency cycles)
export type DialogDisplayMode = 'normal' | 'maximize' | 'full-screen';

export interface MultiStepDialogPosition {
  x: number;
  y: number;
}

export interface MultiStepDialogSize {
  width: number;
  height: number;
}

/**
 * Step-level status snapshot shared between worker and UI layers.
 */
export interface DialogStepStatus {
  /** Stable identifier of the step (matches PluginStepConfig.id) */
  id: string;
  /** Localised title resolved for the current viewer */
  title: string;
  /** Whether the step can currently be navigated to */
  enabled: boolean;
  /** Whether the step satisfies validation requirements */
  completed: boolean;
  /** Optional validation error message to surface to the UI */
  error?: string | null;
}

/**
 * Aggregated state for a multi-step plugin dialog.
 */
export interface MultiStepDialogState {
  /** The node this snapshot belongs to */
  nodeId: NodeId;
  /** Current active step index in zero-based numbering */
  activeStepIndex: number;
  /** Ordered step metadata */
  steps: DialogStepStatus[];
  /** Whether forward navigation is currently allowed */
  canProceedNext: boolean;
  /** Whether back navigation is currently allowed */
  canGoBack: boolean;
  /** Whether the dialog content can be committed/saved */
  canSave: boolean;
  /** Whether batch processing is currently permitted */
  canStartBatch: boolean;
  /** Optional mapping of stepId → validation error message */
  validationErrors?: Record<string, string>;
  /** Unix epoch milliseconds when this snapshot was produced */
  updatedAt: number;
  /** Arbitrary metadata for plugin-specific extensions */
  metadata?: Record<string, unknown>;
}

export interface DialogStateUpdateInput {
  nodeId: NodeId;
  nodeType: string;
  state: MultiStepDialogState | null;
}

export interface DialogStateRequestInput {
  nodeId: NodeId;
  nodeType: string;
}

export interface DialogStateSubscribeInput extends DialogStateRequestInput {
  /** Optional debounce interval in milliseconds for worker-side emissions */
  throttleMs?: number;
}

/**
 * UI dialog runtime state to keep layout/navigation/save flags together.
 */
export interface DialogViewState {
  /** Dialog size (pixels) */
  size: MultiStepDialogSize;
  /** Dialog position (pixels) */
  position: MultiStepDialogPosition;
  /** Current display mode (e.g. normal/full-screen) */
  displayMode: DialogDisplayMode;
  /** Current active step index */
  activeStepIndex: number;
  /** Whether a save/commit is in-flight */
  isSaving: boolean;
  /** Optional multi-step status snapshot from worker/UI coordination */
  multiStepState?: MultiStepDialogState | null;
}

/**
 * Input for patching dialog state in UI.
 */
export interface DialogViewStatePatchInput {
  /** Partial update for DialogViewState */
  patch: Partial<DialogViewState>;
  /** Optional flag to reset to defaults before applying patch */
  reset?: boolean;
}
