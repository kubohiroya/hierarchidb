import type {
  DialogDisplayMode,
  DialogPosition,
  DialogProgressState,
  DialogSize,
  DialogState,
  DialogUIState,
  DialogWindowState,
} from '@hierarchidb/tree-api';
import { useCallback, useEffect, useMemo, useRef } from 'react';

type RestoreDeps = {
  setActiveStepIndex: (next: number) => void;
  setUrlStep: (next: number) => void;
  handleSizeChange: (next?: DialogSize) => void;
  handlePositionChange: (next?: DialogPosition) => void;
  transitionDisplayMode: (
    mode: DialogDisplayMode,
    options?: {
      restoreSize?: DialogSize | null;
      restorePosition?: DialogPosition | null;
      source?: 'explicit' | 'url-sync' | 'restore';
    }
  ) => Promise<void>;
};

export function useDialogUIStateSync(params: {
  dialogUIState: DialogUIState | null;
  activeStepIndex: number;
  dialogPosition: DialogPosition;
  dialogSize: DialogSize;
  displayMode: DialogDisplayMode;
  allowFullScreen?: boolean;
  forceInitialStep?: boolean;
  urlStep?: number | null;
  restoreKey?: string | number | null;
  restoreDeps: RestoreDeps;
}) {
  const {
    dialogUIState,
    activeStepIndex,
    dialogPosition,
    dialogSize,
    displayMode,
    allowFullScreen = true,
    forceInitialStep = false,
    urlStep,
    restoreKey,
    restoreDeps,
  } = params;

  const toInternalStepIndex = useCallback((stepNumber?: number): number => {
    if (typeof stepNumber !== 'number' || Number.isNaN(stepNumber)) return 0;
    return Math.max(stepNumber - 1, 0);
  }, []);

  const toPersistedStepIndex = useCallback((index?: number): number => {
    if (typeof index !== 'number' || Number.isNaN(index)) return 1;
    return Math.max(index + 1, 1);
  }, []);

  const restoreKeyRef = useRef<string | number | null>(restoreKey ?? null);
  const progressRestoredRef = useRef(false);
  const windowRestoredRef = useRef(false);
  useEffect(() => {
    if (restoreKey === undefined) return;
    if (restoreKeyRef.current === restoreKey) return;
    restoreKeyRef.current = restoreKey ?? null;
    progressRestoredRef.current = false;
    windowRestoredRef.current = false;
  }, [restoreKey]);
  const dialogUIStateRef = useRef<DialogUIState | null>(dialogUIState ?? null);
  useEffect(() => {
    if (!dialogUIState) return;
    const prev = dialogUIStateRef.current;
    if (!prev || !windowRestoredRef.current) {
      dialogUIStateRef.current = dialogUIState;
      return;
    }
    const nextWindow = dialogUIState.dialogWindow ?? null;
    const nextProgress = dialogUIState.dialogProgress ?? null;
    const mergedWindow = prev.dialogWindow ?? nextWindow;
    const mergedProgress = nextProgress ?? prev.dialogProgress ?? null;
    dialogUIStateRef.current =
      mergedWindow || mergedProgress
        ? {
            dialogWindow: mergedWindow ?? null,
            dialogProgress: mergedProgress ?? null,
          }
        : null;
  }, [dialogUIState]);

  useEffect(() => {
    const state = dialogUIStateRef.current;
    if (!state) return;
    const windowState = state.dialogWindow;
    if (!windowRestoredRef.current && windowState) {
      const rawMode = windowState.mode as DialogDisplayMode | undefined;
      const mode =
        !allowFullScreen && rawMode === 'full-screen' ? 'normal' : rawMode;
      if (mode) {
        void restoreDeps.transitionDisplayMode(mode, { source: 'restore' }).catch(() => void 0);
      }
      const canApplyFrame = mode !== 'full-screen' && mode !== 'maximize';
      if (canApplyFrame && windowState.size) {
        restoreDeps.handleSizeChange(windowState.size as DialogSize);
      }
      if (canApplyFrame && windowState.position) {
        restoreDeps.handlePositionChange(windowState.position as DialogPosition);
      }
      windowRestoredRef.current = true;
    }
    if (!progressRestoredRef.current) {
      if (typeof urlStep === 'number' && Number.isFinite(urlStep) && urlStep >= 1) {
        progressRestoredRef.current = true;
        return;
      }
      const progress = state.dialogProgress?.activeStepIndex;
      if (!forceInitialStep && typeof progress === 'number') {
        const nextIndex = toInternalStepIndex(progress);
        restoreDeps.setActiveStepIndex(nextIndex);
        restoreDeps.setUrlStep(nextIndex);
      }
      progressRestoredRef.current = true;
    }
  }, [dialogUIState, forceInitialStep, restoreDeps, restoreKey, toInternalStepIndex, urlStep]);

  const updateDialogUIState = useCallback((patch: Partial<DialogUIState>) => {
    const prev = dialogUIStateRef.current ?? null;
    const nextWindow = patch.dialogWindow !== undefined ? patch.dialogWindow : prev?.dialogWindow;
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
    const currentProgress: Partial<DialogProgressState> =
      dialogUIStateRef.current?.dialogProgress ?? {};
    const persistedIndex =
      typeof currentProgress.activeStepIndex === 'number' && currentProgress.activeStepIndex >= 1
        ? currentProgress.activeStepIndex
        : toPersistedStepIndex(activeStepIndexRef.current ?? activeStepIndex);
    const resolvedMode =
      !allowFullScreen && displayMode === 'full-screen' ? 'normal' : displayMode;
    return {
      dialogWindow: {
        mode: currentWindow.mode ?? resolvedMode,
        position: currentWindow.position ?? dialogPosition,
        size: currentWindow.size ?? dialogSize,
        restorePosition: currentWindow.restorePosition ?? null,
        restoreSize: currentWindow.restoreSize ?? null,
      },
      dialogProgress: {
        activeStepIndex: persistedIndex,
      },
    };
  }, [activeStepIndex, allowFullScreen, dialogPosition, dialogSize, displayMode]);

  const dialogStateSnapshot: DialogState | null = useMemo(() => {
    const windowState = dialogUIStateRef.current?.dialogWindow;
    if (!windowState) return null;
    const resolvedMode =
      !allowFullScreen && displayMode === 'full-screen' ? 'normal' : displayMode;
    return {
      activeStepIndex:
        dialogUIStateRef.current?.dialogProgress?.activeStepIndex ??
        toPersistedStepIndex(activeStepIndex),
      size: windowState.size ?? dialogSize,
      position: windowState.position ?? dialogPosition,
      displayMode: (windowState.mode as DialogDisplayMode | undefined) ?? resolvedMode,
      updatedAt: Date.now(),
    };
  }, [activeStepIndex, allowFullScreen, dialogPosition, dialogSize, displayMode, toPersistedStepIndex]);

  const updateDialogState = useCallback(
    (patch: Partial<DialogState>) => {
      const nextWindow: DialogWindowState = {
        mode: patch.displayMode ?? dialogUIStateRef.current?.dialogWindow?.mode ?? displayMode,
        position:
          patch.position ?? dialogUIStateRef.current?.dialogWindow?.position ?? dialogPosition,
        size: patch.size ?? dialogUIStateRef.current?.dialogWindow?.size ?? dialogSize,
        restorePosition: dialogUIStateRef.current?.dialogWindow?.restorePosition ?? null,
        restoreSize: dialogUIStateRef.current?.dialogWindow?.restoreSize ?? null,
      };
      const nextProgress: DialogProgressState | null =
        patch.activeStepIndex !== undefined
          ? { activeStepIndex: toPersistedStepIndex(patch.activeStepIndex) }
          : (dialogUIStateRef.current?.dialogProgress ?? null);
      updateDialogUIState({
        dialogWindow: nextWindow,
        dialogProgress: nextProgress,
      });
    },
    [dialogPosition, dialogSize, displayMode, updateDialogUIState, toPersistedStepIndex]
  );

  return {
    dialogUIStateRef,
    updateDialogUIState,
    getPersistableDialogUIState,
    dialogStateSnapshot,
    updateDialogState,
  };
}
