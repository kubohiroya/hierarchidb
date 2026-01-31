import { useCallback, useState } from 'react';
import type { DialogDisplayMode, DialogPosition, DialogSize } from '@hierarchidb/tree-api';

export interface DialogViewState {
  size: DialogSize;
  position: DialogPosition;
  displayMode: DialogDisplayMode;
  activeStepIndex: number;
}

export interface UseDialogViewStateOptions {
  initialSize: DialogSize;
  initialPosition: DialogPosition;
  initialDisplayMode: DialogDisplayMode;
  initialActiveStepIndex: number;
}

export const useDialogViewState = (options: UseDialogViewStateOptions) => {
  const [dialogViewState, setDialogViewState] = useState<DialogViewState>({
    size: options.initialSize,
    position: options.initialPosition,
    displayMode: options.initialDisplayMode,
    activeStepIndex: options.initialActiveStepIndex,
  });

  const updateDialogViewState = useCallback(
    (patch: Partial<DialogViewState>) => {
      setDialogViewState((prev) => ({
        ...prev,
        ...patch,
        size: patch.size ?? prev.size,
        position: patch.position ?? prev.position,
        displayMode: patch.displayMode ?? prev.displayMode,
        activeStepIndex:
          typeof patch.activeStepIndex === 'number' ? patch.activeStepIndex : prev.activeStepIndex,
      }));
    },
    []
  );

  return { dialogViewState, updateDialogViewState };
};
