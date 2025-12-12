import { useDialogUrlSync } from '@hierarchidb/plugin-base';
import {
  normalizeDialogState,
  getPresetSize,
  initialPosition,
  getViewportSize,
  FRAME_CONSTANTS,
  sizesEqual,
  positionsEqual,
} from '@hierarchidb/ui-dialog';
import { DEFAULT_POSITION, DEFAULT_SIZE,
  type DialogDisplayMode, type DialogPosition, type DialogSize, type NodeId, type DialogUIState } from '@hierarchidb/common-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';

interface Params {
  nodeType: string;
  nodeId: NodeId;
  pageNodeId: NodeId;
  initialStep: number;
  initialDialogUIState?: DialogUIState | null;
}

export function clampIndex(index:number, length: number): number {
  return Math.max(0, Math.min(index, length - 1));
}

export function useDialogFrameState({
  nodeType: _nodeType,
  nodeId: _nodeId,
  initialStep,
  initialDialogUIState,
}: Params): {
  activeStepIndex: number;
  setActiveStepIndex: (value: number) => void;
  setUrlStep: (next: number) => void;
  displayMode: DialogDisplayMode;
  dialogSize: DialogSize;
  dialogPosition: DialogPosition;
  transitionDisplayMode: (mode: DialogDisplayMode) => Promise<void>;
  handleSizeChange: (next?: DialogSize) => void;
  handlePositionChange: (next?: DialogPosition) => void;
  dialogRef: React.RefObject<HTMLDivElement | null>;
} {
  const {
    step: urlStep,
    setStep: setUrlStep,
    mode: urlMode,
    setMode: setUrlMode,
  } = useDialogUrlSync({
    namespace: '',
    defaults: { step: initialStep, mode: 'normal' },
    debounce: { map: 0 },
    history: { step: 'replace' },
  });

  const [activeStepIndex, setActiveStepIndex] = useState(initialStep);
  useEffect(() => {
    if (typeof urlStep === 'number') {
      setActiveStepIndex(clampIndex(urlStep, Number.POSITIVE_INFINITY));
    }
  }, [urlStep]);

  const [displayMode, setDisplayModeState] = useState<DialogDisplayMode>('normal');
  const [dialogSize, setDialogSize] = useState<DialogSize>(DEFAULT_SIZE);
  const [dialogPosition, setDialogPosition] = useState<DialogPosition>(DEFAULT_POSITION);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const dialogSizeRef = useRef(dialogSize);
  const dialogPositionRef = useRef(dialogPosition);
  const hydratedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    dialogSizeRef.current = dialogSize;
  }, [dialogSize]);

  useEffect(() => {
    dialogPositionRef.current = dialogPosition;
  }, [dialogPosition]);

  useEffect(() => {
    // default to initialStep/url sync values; no external persistence
    setUrlMode(displayMode === 'full-screen' ? 'full' : 'normal');
  }, [displayMode, setUrlMode]);

  const persistDisplayMode = useCallback(
    (value: DialogDisplayMode) => {
      setDisplayModeState(value);
      setUrlMode(value === 'full-screen' ? 'full' : 'normal');
    },
    [setUrlMode]
  );

  const persistPosition = useCallback(
    (next: DialogPosition) => {
      setDialogPosition(next);
      dialogPositionRef.current = next;
    },
    []
  );

  const persistSize = useCallback(
    (next: DialogSize) => {
      setDialogSize(next);
      dialogSizeRef.current = next;
    },
    []
  );

  useEffect(() => {
    const key = String(_nodeId ?? 'unknown');
    if (!initialDialogUIState) return;
    if (hydratedKeyRef.current === key) return;

    const viewport = getViewportSize();
    const windowState = initialDialogUIState.dialogWindow;
    const progressState = initialDialogUIState.dialogProgress;
    const mode = windowState?.mode ?? 'normal';
    const size = windowState?.size ?? dialogSizeRef.current;
    const position = windowState?.position ?? dialogPositionRef.current;

    if (mode === 'full-screen') {
      persistSize({
        width: Math.max(viewport.width, FRAME_CONSTANTS.MIN_DIALOG_WIDTH),
        height: Math.max(viewport.height, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT),
      });
      persistPosition({ x: 0, y: 0 });
    } else {
      const normalized = normalizeDialogState(size, position, viewport, {
        enforceTopLeftMargin: mode === 'normal',
        minPosition: 0,
        clampSizeToViewport: true,
      });
      persistSize(normalized.size);
      persistPosition(normalized.position);
    }

    persistDisplayMode(mode);
    if (typeof progressState?.activeStepIndex === 'number') {
      const nextStep = clampIndex(progressState.activeStepIndex, Number.POSITIVE_INFINITY);
      setActiveStepIndex(nextStep);
      setUrlStep(nextStep);
    }

    hydratedKeyRef.current = key;
  }, [initialDialogUIState, persistDisplayMode, persistPosition, persistSize, setUrlStep, _nodeId]);

  const transitionDisplayMode = useCallback(
    async (mode: DialogDisplayMode) => {
      const viewport = getViewportSize();

      const applyNormalizedState = (size: DialogSize, position: DialogPosition) => {
        dialogSizeRef.current = size;
        dialogPositionRef.current = position;
        persistSize(size);
        persistPosition(position);
      };

      if (mode === 'full-screen') {
        const fullSize: DialogSize = {
          width: Math.max(viewport.width, FRAME_CONSTANTS.MIN_DIALOG_WIDTH),
          height: Math.max(viewport.height, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT),
        };
        applyNormalizedState(fullSize, { x: 0, y: 0 });
      } else if (mode === 'maximize') {
        const size = getPresetSize('maximize', viewport);
        const position = initialPosition(size, viewport);
        const normalized = normalizeDialogState(size, position, viewport, {
          enforceTopLeftMargin: false,
          minPosition: 0,
          clampSizeToViewport: true,
        });
        applyNormalizedState(normalized.size, normalized.position);
      } else {
        const size = getPresetSize('normal', viewport);
        const position = initialPosition(size, viewport);
        const normalized = normalizeDialogState(size, position, viewport, {
          enforceTopLeftMargin: true,
        });
        applyNormalizedState(normalized.size, normalized.position);
      }

      setDisplayModeState(mode);
      persistDisplayMode(mode);
    },
    [persistDisplayMode, persistPosition, persistSize]
  );

  useEffect(() => {
    const modeKey = urlMode as string;
    if (modeKey === 'full') {
      void transitionDisplayMode('full-screen');
    } else if (displayMode === 'full-screen' && modeKey !== 'full') {
      void transitionDisplayMode('normal');
    }
  }, [urlMode, displayMode, transitionDisplayMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let rafId: number | null = null;

    const normalize = () => {
      rafId = null;
      const viewport = getViewportSize();
      let targetSize = dialogSizeRef.current;
      let targetPosition = dialogPositionRef.current;
      let options = {
        enforceTopLeftMargin: displayMode === 'normal',
        minPosition: 0,
        clampSizeToViewport: true,
      };

      if (displayMode === 'full-screen') {
        targetSize = {
          width: Math.max(viewport.width, FRAME_CONSTANTS.MIN_DIALOG_WIDTH),
          height: Math.max(viewport.height, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT),
        };
        targetPosition = { x: 0, y: 0 };
        options = {
          enforceTopLeftMargin: false,
          minPosition: 0,
          clampSizeToViewport: false,
        };
      } else if (displayMode === 'maximize') {
        targetSize = getPresetSize('maximize', viewport);
        targetPosition = initialPosition(targetSize, viewport);
        options = {
          enforceTopLeftMargin: false,
          minPosition: 0,
          clampSizeToViewport: true,
        };
      }

      const normalized = normalizeDialogState(targetSize, targetPosition, viewport, options);
      if (!sizesEqual(dialogSizeRef.current, normalized.size)) {
        dialogSizeRef.current = normalized.size;
        persistSize(normalized.size);
      }
      if (!positionsEqual(dialogPositionRef.current, normalized.position)) {
        dialogPositionRef.current = normalized.position;
        persistPosition(normalized.position);
      }
    };

    const schedule = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(normalize);
    };

    window.addEventListener('resize', schedule, { passive: true });
    schedule();

    return () => {
      window.removeEventListener('resize', schedule);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
  }, [displayMode, persistPosition, persistSize]);

  const handleSizeChange = useCallback(
    (next?: DialogSize) => {
      if (!next) return;
      const viewport = getViewportSize();
      const normalized = normalizeDialogState(next, dialogPositionRef.current, viewport, {
        enforceTopLeftMargin: displayMode === 'normal',
        minPosition: 0,
        clampSizeToViewport: true,
      });
      if (!sizesEqual(dialogSizeRef.current, normalized.size)) {
        persistSize(normalized.size);
      }
      if (!positionsEqual(dialogPositionRef.current, normalized.position)) {
        persistPosition(normalized.position);
      }
    },
    [displayMode, persistPosition, persistSize]
  );

  const handlePositionChange = useCallback(
    (next?: DialogPosition) => {
      if (!next) return;
      const viewport = getViewportSize();
      const normalized = normalizeDialogState(dialogSizeRef.current, next, viewport, {
        enforceTopLeftMargin: displayMode === 'normal',
        minPosition: 0,
        clampSizeToViewport: true,
      });
      if (!sizesEqual(dialogSizeRef.current, normalized.size)) {
        persistSize(normalized.size);
      }
      if (!positionsEqual(dialogPositionRef.current, normalized.position)) {
        persistPosition(normalized.position);
      }
    },
    [displayMode, persistPosition, persistSize]
  );

  return {
    activeStepIndex,
    setActiveStepIndex,
    setUrlStep,
    displayMode,
    dialogSize,
    dialogPosition,
    transitionDisplayMode,
    handleSizeChange,
    handlePositionChange,
    dialogRef,
  };
}
