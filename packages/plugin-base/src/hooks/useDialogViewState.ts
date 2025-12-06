import { useCallback, useMemo, useRef, useState } from 'react';
import type { DialogDisplayMode, MultiStepDialogPosition, MultiStepDialogSize } from '@hierarchidb/ui-dialog';
import type { DialogViewState, DialogViewStatePatchInput } from '@hierarchidb/common-types';

const DEFAULT_SIZE: MultiStepDialogSize = { width: 960, height: 640 };
const DEFAULT_POSITION: MultiStepDialogPosition = { x: 64, y: 64 };
const DEFAULT_DISPLAY_MODE: DialogDisplayMode = 'normal';

export interface UseDialogViewStateOptions {
  initialSize?: MultiStepDialogSize;
  initialPosition?: MultiStepDialogPosition;
  initialDisplayMode?: DialogDisplayMode;
  initialActiveStepIndex?: number;
}

export interface UseDialogViewStateResult {
  dialogViewState: DialogViewState;
  updateDialogViewState: (input: DialogViewStatePatchInput) => void;
  resetDialogViewState: () => void;
}

/**
 * Consolidated dialog state manager for multi-step dialogs.
 * Keeps layout (size/position/displayMode), navigation (activeStepIndex),
 * and saving status (isSaving) in one place to reduce scattered useState usage.
 */
export function useDialogViewState(options: UseDialogViewStateOptions = {}): UseDialogViewStateResult {
  const {
    initialSize = DEFAULT_SIZE,
    initialPosition = DEFAULT_POSITION,
    initialDisplayMode = DEFAULT_DISPLAY_MODE,
    initialActiveStepIndex = 0,
  } = options;

  const initialStateRef = useRef<DialogViewState>({
    size: initialSize,
    position: initialPosition,
    displayMode: initialDisplayMode,
    activeStepIndex: initialActiveStepIndex,
    isSaving: false,
    multiStepState: null,
  });

  const [dialogViewState, setDialogViewState] = useState<DialogViewState>(initialStateRef.current);

  const resetDialogViewState = useCallback(() => {
    setDialogViewState(initialStateRef.current);
  }, []);

  const updateDialogViewState = useCallback((input: DialogViewStatePatchInput) => {
    setDialogViewState((prev: DialogViewState) => {
      const base = input.reset ? initialStateRef.current : prev;
      return { ...base, ...input.patch };
    });
  }, []);

  return useMemo(
    () => ({
      dialogViewState,
      updateDialogViewState,
      resetDialogViewState,
    }),
    [dialogViewState, updateDialogViewState, resetDialogViewState]
  );
}
