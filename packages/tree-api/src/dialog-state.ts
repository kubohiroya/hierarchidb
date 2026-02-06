export interface DialogPosition {
  x: number;
  y: number;
}

export interface DialogSize {
  width: number;
  height: number;
}

export type DialogDisplayMode = 'normal' | 'maximize' | 'full-screen';

export interface DialogWindowState {
  mode?: DialogDisplayMode;
  position?: DialogPosition | null;
  size?: DialogSize | null;
  restorePosition?: DialogPosition | null;
  restoreSize?: DialogSize | null;
}

export interface DialogProgressState {
  /** Zero-based index of the last active step when the dialog was persisted. */
  activeStepIndex: number;
}

export interface DialogUIState {
  dialogWindow?: DialogWindowState | null;
  dialogProgress?: DialogProgressState | null;
  // Add minimal UI-only flags here to avoid mixing with domain data.
}

export interface DialogState {
  activeStepIndex: number;
  size: DialogSize;
  position: DialogPosition;
  displayMode: DialogDisplayMode;
  updatedAt: number;
}
