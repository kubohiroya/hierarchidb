import { useDialogUrlSync } from '@hierarchidb/plugin-base';
import {
  normalizeDialogState,
  getViewportSize,
  getPresetSize,
  initialPosition,
  FRAME_CONSTANTS,
  sizesEqual,
  positionsEqual,
  getDialogLayoutViewport,
} from '@hierarchidb/ui-dialog';
import {
  type DialogDisplayMode,
  type DialogPosition,
  type DialogSize,
  type NodeId,
  type DialogUIState,
} from '@hierarchidb/common-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';

interface Params {
  nodeType: string;
  nodeId: NodeId;
  pageNodeId: NodeId;
  initialStep: number;
  forceInitialStep?: boolean;
  initialDialogUIState?: DialogUIState | null;
}

export function clampIndex(index:number, length: number): number {
  return Math.max(0, Math.min(index, length - 1));
}

const toInternalStepIndex = (stepNumber: number): number => Math.max(stepNumber - 1, 0);
const toStepNumber = (index: number): number => Math.max(index + 1, 1);

export function useDialogFrameState({
  nodeType: _nodeType,
  nodeId: _nodeId,
  initialStep,
  forceInitialStep = false,
  initialDialogUIState,
}: Params): {
  activeStepIndex: number;
  setActiveStepIndex: (value: number) => void;
  setUrlStep: (next: number) => void;
  displayMode: DialogDisplayMode;
  dialogSize: DialogSize;
  dialogPosition: DialogPosition;
  transitionDisplayMode: (
    mode: DialogDisplayMode,
    options?: { restoreSize?: DialogSize | null; restorePosition?: DialogPosition | null }
  ) => Promise<void>;
  handleSizeChange: (next?: DialogSize) => void;
  handlePositionChange: (next?: DialogPosition) => void;
  dialogRef: React.RefObject<HTMLDivElement | null>;
} {
  const readFrom =
    typeof window !== 'undefined' && window.location.hash.startsWith('#/') ? 'hash' : 'search';
  const {
    step: urlStep,
    setStep: setUrlStep,
    mode: urlMode,
    setMode: setUrlMode,
  } = useDialogUrlSync({
    namespace: '',
    defaults: { step: Math.max(initialStep, 1), mode: 'normal' },
    debounce: { map: 0 },
    history: { step: 'replace' },
    readFrom,
  });

  const [activeStepIndex, setActiveStepIndex] = useState(toInternalStepIndex(initialStep));
  useEffect(() => {
    if (typeof urlStep === 'number') {
      setActiveStepIndex(clampIndex(toInternalStepIndex(urlStep), Number.POSITIVE_INFINITY));
    }
  }, [urlStep]);

  const setUrlStepInternal = useCallback(
    (nextIndex: number) => {
      setUrlStep(toStepNumber(nextIndex));
    },
    [setUrlStep]
  );

  const initialFrame = (() => {
    const viewport = getViewportSize();
    const size = getPresetSize('normal', viewport);
    return normalizeDialogState(
      size,
      initialPosition(size, viewport),
      viewport,
      { enforceTopLeftMargin: true },
    );
  })();

  const defaultFrameRef = useRef<typeof initialFrame | null>(initialFrame);

  const [displayMode, setDisplayModeState] = useState<DialogDisplayMode>('normal');
  const [dialogSize, setDialogSize] = useState<DialogSize>(initialFrame.size);
  const [dialogPosition, setDialogPosition] = useState<DialogPosition>(initialFrame.position);

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
    const layoutViewport = getDialogLayoutViewport();
    const windowState = initialDialogUIState.dialogWindow;
    const progressState = initialDialogUIState.dialogProgress;
    const mode = windowState?.mode ?? 'normal';
    const size = windowState?.size ?? dialogSizeRef.current;
    const position = windowState?.position ?? dialogPositionRef.current;

    if (mode === 'full-screen') {
      persistSize({
        width: Math.max(layoutViewport.width, FRAME_CONSTANTS.MIN_DIALOG_WIDTH),
        height: Math.max(layoutViewport.height, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT),
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

    defaultFrameRef.current = null;
    persistDisplayMode(mode);
    if (!forceInitialStep && typeof progressState?.activeStepIndex === 'number') {
      const nextStep = clampIndex(
        toInternalStepIndex(progressState.activeStepIndex),
        Number.POSITIVE_INFINITY
      );
      setActiveStepIndex(nextStep);
      setUrlStepInternal(nextStep);
    }

    hydratedKeyRef.current = key;
  }, [
    forceInitialStep,
    initialDialogUIState,
    persistDisplayMode,
    persistPosition,
    persistSize,
    setUrlStepInternal,
    _nodeId,
  ]);

  const transitionDisplayMode = useCallback(
    async (
      mode: DialogDisplayMode,
      options?: { restoreSize?: DialogSize | null; restorePosition?: DialogPosition | null }
    ) => {
      const layoutViewport = getDialogLayoutViewport();
      const viewport = getViewportSize();
      const restoreSize = options?.restoreSize ?? null;
      const restorePosition = options?.restorePosition ?? null;

      const applyNormalizedState = (size: DialogSize, position: DialogPosition) => {
        dialogSizeRef.current = size;
        dialogPositionRef.current = position;
        persistSize(size);
        persistPosition(position);
      };

      if (mode === 'full-screen') {
        const fullSize: DialogSize = {
          width: Math.max(layoutViewport.width, FRAME_CONSTANTS.MIN_DIALOG_WIDTH),
          height: Math.max(layoutViewport.height, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT),
        };
        applyNormalizedState(fullSize, { x: 0, y: 0 });
      } else if (mode === 'maximize') {
        const size = getPresetSize('maximize', layoutViewport);
        const position = initialPosition(size, layoutViewport);
        const normalized = normalizeDialogState(size, position, layoutViewport, {
          enforceTopLeftMargin: false,
          minPosition: 0,
          clampSizeToViewport: true,
        });
        applyNormalizedState(normalized.size, normalized.position);
      } else {
        const size = restoreSize ?? getPresetSize('normal', viewport);
        const position = restorePosition ?? initialPosition(size, viewport);
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
      const layoutViewport = getDialogLayoutViewport();
      let targetSize = dialogSizeRef.current;
      let targetPosition = dialogPositionRef.current;
      let options = {
        enforceTopLeftMargin: displayMode === 'normal',
        minPosition: 0,
        clampSizeToViewport: true,
      };

      if (displayMode === 'full-screen') {
        targetSize = {
          width: Math.max(layoutViewport.width, FRAME_CONSTANTS.MIN_DIALOG_WIDTH),
          height: Math.max(layoutViewport.height, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT),
        };
        targetPosition = { x: 0, y: 0 };
        options = {
          enforceTopLeftMargin: false,
          minPosition: 0,
          clampSizeToViewport: false,
        };
      } else if (displayMode === 'maximize') {
        targetSize = getPresetSize('maximize', layoutViewport);
        targetPosition = initialPosition(targetSize, layoutViewport);
        options = {
          enforceTopLeftMargin: false,
          minPosition: 0,
          clampSizeToViewport: true,
        };
      }

      const shouldRecenter = defaultFrameRef.current
        && sizesEqual(dialogSizeRef.current, defaultFrameRef.current.size)
        && positionsEqual(dialogPositionRef.current, defaultFrameRef.current.position);

      if (shouldRecenter) {
        const recentered = normalizeDialogState(
          targetSize,
          initialPosition(targetSize, viewport),
          viewport,
          options,
        );
        defaultFrameRef.current = recentered;
        targetSize = recentered.size;
        targetPosition = recentered.position;
      }

      const normalizationViewport = displayMode === 'normal' ? viewport : layoutViewport;
      const normalized = normalizeDialogState(
        targetSize,
        targetPosition,
        normalizationViewport,
        options
      );
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
      defaultFrameRef.current = null;
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
      defaultFrameRef.current = null;
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
    setUrlStep: setUrlStepInternal,
    displayMode,
    dialogSize,
    dialogPosition,
    transitionDisplayMode,
    handleSizeChange,
    handlePositionChange,
    dialogRef,
  };
}
