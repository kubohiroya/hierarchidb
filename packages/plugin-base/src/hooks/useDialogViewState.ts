import { useCallback, useMemo, useRef, useState } from 'react';
import type { DialogDisplayMode, MultiDialogPosition, MultiDialogSize } from '@hierarchidb/ui-dialog';
import type { DialogViewState, DialogViewStatePatchInput } from '@hierarchidb/common-types';

const DEFAULT_SIZE: MultiDialogSize = { width: 960, height: 640 };
const DEFAULT_POSITION: MultiDialogPosition = { x: 64, y: 64 };
const DEFAULT_DISPLAY_MODE: DialogDisplayMode = 'normal';

export interface UseDialogViewStateOptions {
  initialSize?: MultiDialogSize;
  initialPosition?: MultiDialogPosition;
  initialDisplayMode?: DialogDisplayMode;
  initialActiveStepIndex?: number;
}

export interface UseDialogViewStateResult {
  dialogState: DialogViewState;
  updateDialogState: (input: DialogViewStatePatchInput) => void;
  resetDialogState: () => void;
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

  const [dialogState, setDialogState] = useState<DialogViewState>(initialStateRef.current);

  const resetDialogState = useCallback(() => {
    setDialogState(initialStateRef.current);
  }, []);

  const updateDialogState = useCallback((input: DialogViewStatePatchInput) => {
    setDialogState((prev: DialogViewState) => {
      const base = input.reset ? initialStateRef.current : prev;
      return { ...base, ...input.patch };
    });
  }, []);

  return useMemo(
    () => ({
      dialogState,
      updateDialogState,
      resetDialogState,
    }),
    [dialogState, updateDialogState, resetDialogState]
  );
}
