import { useCallback, useEffect, useMemo, useRef } from 'react';
import type {
  DialogDisplayMode,
  DialogPosition,
  DialogProgressState,
  DialogSize,
  DialogState,
  DialogUIState,
  DialogWindowState,
} from '@hierarchidb/common-types';

type RestoreDeps = {
  setActiveStepIndex: (next: number) => void;
  setUrlStep: (next: number) => void;
  handleSizeChange: (next?: DialogSize) => void;
  handlePositionChange: (next?: DialogPosition) => void;
  transitionDisplayMode: (mode: DialogDisplayMode) => Promise<void>;
};

export function useDialogUIStateSync(params: {
  dialogUIState: DialogUIState | null;
  activeStepIndex: number;
  dialogPosition: DialogPosition;
  dialogSize: DialogSize;
  displayMode: DialogDisplayMode;
  restoreDeps: RestoreDeps;
}) {
  const {
    dialogUIState,
    activeStepIndex,
    dialogPosition,
    dialogSize,
    displayMode,
    restoreDeps,
  } = params;

  const dialogUIStateRef = useRef<DialogUIState | null>(dialogUIState ?? null);
  useEffect(() => {
    dialogUIStateRef.current = dialogUIState ?? null;
  }, [dialogUIState]);

  const dialogStateRestoredRef = useRef(false);
  useEffect(() => {
    if (dialogStateRestoredRef.current) return;
    const state = dialogUIStateRef.current;
    if (!state) return;
    dialogStateRestoredRef.current = true;
    const progress = state.dialogProgress?.activeStepIndex;
    if (typeof progress === 'number') {
      restoreDeps.setActiveStepIndex(progress);
      restoreDeps.setUrlStep(progress);
    }
    const windowState = state.dialogWindow;
    if (windowState?.size) {
      restoreDeps.handleSizeChange(windowState.size as DialogSize);
    }
    if (windowState?.position) {
      restoreDeps.handlePositionChange(windowState.position as DialogPosition);
    }
    if (windowState?.mode) {
      void restoreDeps.transitionDisplayMode(windowState.mode as DialogDisplayMode).catch(() => void 0);
    }
  }, [restoreDeps]);

  const updateDialogUIState = useCallback((patch: Partial<DialogUIState>) => {
    const prev = dialogUIStateRef.current ?? null;
    const nextWindow =
      patch.dialogWindow !== undefined ? patch.dialogWindow : prev?.dialogWindow;
    const nextProgress =
      patch.dialogProgress !== undefined ? patch.dialogProgress : prev?.dialogProgress;
    const next: DialogUIState | null =
      nextWindow || nextProgress
        ? {
            dialogWindow: nextWindow ?? null,
            dialogProgress: nextProgress ?? null,
          }
        : null;
    dialogUIStateRef.current = next;
  }, []);

  const activeStepIndexRef = useRef(activeStepIndex);
  useEffect(() => {
    activeStepIndexRef.current = activeStepIndex;
  }, [activeStepIndex]);

  const getPersistableDialogUIState = useCallback((): DialogUIState => {
    const currentWindow: Partial<DialogWindowState> = dialogUIStateRef.current?.dialogWindow ?? {};
    const currentProgress: Partial<DialogProgressState> = dialogUIStateRef.current?.dialogProgress ?? {};
    const persistedIndex =
      typeof currentProgress.activeStepIndex === 'number'
        ? currentProgress.activeStepIndex
        : activeStepIndexRef.current ?? activeStepIndex;
    return {
      dialogWindow: {
        mode: currentWindow.mode ?? displayMode,
        position: currentWindow.position ?? dialogPosition,
        size: currentWindow.size ?? dialogSize,
      },
      dialogProgress: {
        activeStepIndex: persistedIndex,
      },
    };
  }, [activeStepIndex, dialogPosition, dialogSize, displayMode]);

  const dialogStateSnapshot: DialogState | null = useMemo(() => {
    const windowState = dialogUIStateRef.current?.dialogWindow;
    if (!windowState) return null;
    return {
      activeStepIndex:
        dialogUIStateRef.current?.dialogProgress?.activeStepIndex ?? activeStepIndex,
      size: windowState.size ?? dialogSize,
      position: windowState.position ?? dialogPosition,
      displayMode: (windowState.mode as DialogDisplayMode | undefined) ?? displayMode,
      updatedAt: Date.now(),
    };
  }, [activeStepIndex, dialogPosition, dialogSize, displayMode]);

  const updateDialogState = useCallback(
    (patch: Partial<DialogState>) => {
      const nextWindow: DialogWindowState = {
        mode: patch.displayMode ?? dialogUIStateRef.current?.dialogWindow?.mode ?? displayMode,
        position:
          patch.position ?? dialogUIStateRef.current?.dialogWindow?.position ?? dialogPosition,
        size: patch.size ?? dialogUIStateRef.current?.dialogWindow?.size ?? dialogSize,
      };
      const nextProgress: DialogProgressState | null =
        patch.activeStepIndex !== undefined
          ? { activeStepIndex: patch.activeStepIndex }
          : dialogUIStateRef.current?.dialogProgress ?? null;
      updateDialogUIState({
        dialogWindow: nextWindow,
        dialogProgress: nextProgress,
      });
    },
    [dialogPosition, dialogSize, displayMode, updateDialogUIState]
  );

  return {
    dialogUIStateRef,
    updateDialogUIState,
    getPersistableDialogUIState,
    dialogStateSnapshot,
    updateDialogState,
  };
}
