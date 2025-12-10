export interface DialogPosition {
  x: number;
  y: number;
}

export interface DialogSize {
  width: number;
  height: number;
}

export type DialogDisplayMode = 'normal' | 'maximize' | 'full-screen';

export const DEFAULT_POSITION: DialogPosition = { x: 64, y: 64 };
export const DEFAULT_SIZE: DialogSize = { width: 960, height: 640 };
export const DEFAULT_DISPLAY_MODE: DialogDisplayMode = 'normal';

export interface DialogState {
  /** Current active step index in zero-based numbering */
  activeStepIndex: number;
  /** Ordered step metadata */
  size: DialogSize;
  /** Dialog position (pixels) */
  position: DialogPosition;
  /** Current display mode (e.g. normal/full-screen) */
  displayMode: DialogDisplayMode;
  /** Unix epoch milliseconds when this snapshot was produced */
  updatedAt: number;
}

/**
 * Step-level status snapshot shared between worker and UI layers.
 */
export interface DialogStepState {
  /** Stable identifier of the step (matches PluginStepConfig.id) */
  id: string;
  /** Whether the step can currently be navigated to */
  enabled: boolean;
  /** Whether the step satisfies validation requirements */
  completed: boolean;
  /** Optional validation error message to surface to the UI */
  errors?: Map<string,unknown> | null;
}

export interface DialogStepperState {
  /** Ordered step metadata */
  steps: DialogStepState[];
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
  /** Whether a save/commit is in-flight */
  isSaving: boolean;
}
