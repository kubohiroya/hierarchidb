export interface DialogPosition {
  x: number;
  y: number;
}

export interface DialogSize {
  width: number;
  height: number;
}

export type DialogDisplayMode = 'normal' | 'maximize' | 'full-screen';

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
