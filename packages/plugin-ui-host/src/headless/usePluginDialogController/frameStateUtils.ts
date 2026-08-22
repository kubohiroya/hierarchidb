import type { NodeId } from '@hierarchidb/core-types';
import type {
  DialogDisplayMode,
  DialogPosition,
  DialogSize,
  DialogUIState,
} from '@hierarchidb/tree-api';
import {
  FRAME_CONSTANTS,
  getDialogLayoutViewport,
  getPresetSize,
  getViewportSize,
  initialPosition,
  normalizeDialogState,
  positionsEqual,
  sizesEqual,
} from '@hierarchidb/ui-dialog';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Params {
  nodeType: string;
  nodeId: NodeId;
  pageNodeId: NodeId;
  initialStep: number;
  forceInitialStep?: boolean;
  initialDialogUIState?: DialogUIState | null;
  allowFullScreen?: boolean;
  urlState?: { mode?: DialogDisplayMode; step?: number };
  onUrlStateChange?: (next: { mode: DialogDisplayMode; step: number }) => void;
}

export function clampIndex(index: number, length: number): number {
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
  allowFullScreen = true,
  urlState,
  onUrlStateChange,
}: Params): {
  activeStepIndex: number;
  setActiveStepIndex: (value: number) => void;
  setUrlStep: (next: number) => void;
  displayMode: DialogDisplayMode;
  dialogSize: DialogSize;
  dialogPosition: DialogPosition;
  transitionDisplayMode: (
    mode: DialogDisplayMode,
    options?: {
      restoreSize?: DialogSize | null;
      restorePosition?: DialogPosition | null;
      source?: 'explicit' | 'url-sync' | 'restore';
    }
  ) => Promise<void>;
  handleSizeChange: (next?: DialogSize) => void;
  handlePositionChange: (next?: DialogPosition) => void;
  dialogRef: React.RefObject<HTMLDivElement | null>;
} {
  const [urlStateInternal, setUrlStateInternal] = useState<{
    mode: DialogDisplayMode;
    step: number;
  }>(() => ({
    mode:
      !allowFullScreen && urlState?.mode === 'full-screen'
        ? 'normal'
        : (urlState?.mode ?? 'normal'),
    step:
      typeof urlState?.step === 'number' && Number.isFinite(urlState.step)
        ? urlState.step
        : Math.max(initialStep, 1),
  }));
  const urlStateSourceRef = useRef<'external' | 'internal' | null>(null);

  useEffect(() => {
    const requestedMode = urlState?.mode ?? 'normal';
    const nextMode = !allowFullScreen && requestedMode === 'full-screen' ? 'normal' : requestedMode;
    const nextStep =
      typeof urlState?.step === 'number' && Number.isFinite(urlState.step)
        ? urlState.step
        : Math.max(initialStep, 1);
    setUrlStateInternal((prev) => {
      if (prev.mode === nextMode && prev.step === nextStep) return prev;
      urlStateSourceRef.current = 'external';
      return { mode: nextMode, step: nextStep };
    });
  }, [initialStep, urlState?.mode, urlState?.step]);

  const updateUrlState = useCallback(
    (patch: Partial<{ mode: DialogDisplayMode; step: number }>) => {
      setUrlStateInternal((prev) => {
        const next = { mode: patch.mode ?? prev.mode, step: patch.step ?? prev.step };
        if (next.mode === prev.mode && next.step === prev.step) return prev;
        urlStateSourceRef.current = 'internal';
        return next;
      });
    },
    [onUrlStateChange]
  );

  const { mode: urlMode, step: urlStep } = urlStateInternal;
  useEffect(() => {
    if (!onUrlStateChange) return;
    if (urlStateSourceRef.current !== 'internal') return;
    urlStateSourceRef.current = null;
    onUrlStateChange(urlStateInternal);
  }, [onUrlStateChange, urlStateInternal]);

  const [activeStepIndex, setActiveStepIndex] = useState(toInternalStepIndex(initialStep));
  useEffect(() => {
    if (typeof urlStep === 'number') {
      setActiveStepIndex(clampIndex(toInternalStepIndex(urlStep), Number.POSITIVE_INFINITY));
    }
  }, [urlStep]);

  const setUrlStepInternal = useCallback(
    (nextIndex: number) => {
      const nextStep = toStepNumber(nextIndex);
      updateUrlState({ step: nextStep });
    },
    [updateUrlState]
  );

  const initialFrame = (() => {
    const viewport = getViewportSize();
    const size = getPresetSize('normal', viewport);
    return normalizeDialogState(size, initialPosition(size, viewport), viewport, {
      enforceTopLeftMargin: true,
    });
  })();

  const defaultFrameRef = useRef<typeof initialFrame | null>(initialFrame);

  const [displayMode, setDisplayModeState] = useState<DialogDisplayMode>(
    !allowFullScreen && urlMode === 'full-screen' ? 'normal' : urlMode
  );
  const [dialogSize, setDialogSize] = useState<DialogSize>(initialFrame.size);
  const [dialogPosition, setDialogPosition] = useState<DialogPosition>(initialFrame.position);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const dialogSizeRef = useRef(dialogSize);
  const dialogPositionRef = useRef(dialogPosition);
  const hydratedKeyRef = useRef<string | null>(null);
  const transitionInFlightRef = useRef<DialogDisplayMode | null>(null);
  const transitionSourceRef = useRef<'explicit' | 'url-sync' | 'restore' | null>(null);
  useEffect(() => {
    dialogSizeRef.current = dialogSize;
  }, [dialogSize]);

  useEffect(() => {
    dialogPositionRef.current = dialogPosition;
  }, [dialogPosition]);

  const persistDisplayMode = useCallback(
    (value: DialogDisplayMode) => {
      setDisplayModeState(value);
      updateUrlState({ mode: value });
    },
    [updateUrlState]
  );

  const persistPosition = useCallback((next: DialogPosition) => {
    setDialogPosition(next);
    dialogPositionRef.current = next;
  }, []);

  const persistSize = useCallback((next: DialogSize) => {
    setDialogSize(next);
    dialogSizeRef.current = next;
  }, []);

  useEffect(() => {
    const key = String(_nodeId ?? 'unknown');
    if (!initialDialogUIState) return;
    if (hydratedKeyRef.current === key) return;

    const viewport = getViewportSize();
    const layoutViewport = getDialogLayoutViewport();
    const windowState = initialDialogUIState.dialogWindow;
    const progressState = initialDialogUIState.dialogProgress;
    const hasUrlMode = typeof urlState?.mode === 'string';
    const requestedMode = (hasUrlMode ? urlState?.mode : windowState?.mode) ?? 'normal';
    const mode = !allowFullScreen && requestedMode === 'full-screen' ? 'normal' : requestedMode;
    const size = windowState?.size ?? dialogSizeRef.current;
    const position = windowState?.position ?? dialogPositionRef.current;

    if (mode === 'full-screen') {
      persistSize({
        width: Math.max(layoutViewport.width, FRAME_CONSTANTS.MIN_DIALOG_WIDTH),
        height: Math.max(layoutViewport.height, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT),
      });
      persistPosition({ x: 0, y: 0 });
    } else if (mode === 'maximize') {
      // URL maximize mode: use preset size instead of persisted dialogUIState
      const maximizeSize = getPresetSize('maximize', layoutViewport);
      const maximizePosition = initialPosition(maximizeSize, layoutViewport);
      const normalized = normalizeDialogState(maximizeSize, maximizePosition, layoutViewport, {
        enforceTopLeftMargin: false,
        minPosition: 0,
        clampSizeToViewport: true,
      });
      persistSize(normalized.size);
      persistPosition(normalized.position);
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
    const hasUrlStep =
      typeof urlState?.step === 'number' && Number.isFinite(urlState.step) && urlState.step >= 1;
    if (!hasUrlStep && !forceInitialStep && typeof progressState?.activeStepIndex === 'number') {
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
    urlState?.mode,
    urlState?.step,
    _nodeId,
  ]);

  const transitionDisplayMode = useCallback(
    async (
      mode: DialogDisplayMode,
      options?: {
        restoreSize?: DialogSize | null;
        restorePosition?: DialogPosition | null;
        source?: 'explicit' | 'url-sync' | 'restore';
      }
    ) => {
      if (options?.source) {
        transitionSourceRef.current = options.source;
      }
      const nextMode = !allowFullScreen && mode === 'full-screen' ? 'normal' : mode;
      if (nextMode !== mode) {
        mode = nextMode;
      }
      if (mode === displayMode && transitionInFlightRef.current === null) {
        return;
      }
      if (transitionInFlightRef.current) {
        if (transitionInFlightRef.current === mode) {
          return;
        }
      }
      transitionInFlightRef.current = mode;
      const layoutViewport = getDialogLayoutViewport();
      const viewport = getViewportSize();
      const restoreSize = options?.restoreSize ?? null;
      const restorePosition = options?.restorePosition ?? null;

      const applyNormalizedState = (size: DialogSize, position: DialogPosition) => {
        const currentSize = dialogSizeRef.current;
        const currentPosition = dialogPositionRef.current;
        if (!sizesEqual(currentSize, size)) {
          persistSize(size);
        }
        if (!positionsEqual(currentPosition, position)) {
          persistPosition(position);
        }
        dialogSizeRef.current = size;
        dialogPositionRef.current = position;
      };

      if (mode === 'full-screen') {
        const fullSize: DialogSize = {
          width: Math.max(layoutViewport.width, FRAME_CONSTANTS.MIN_DIALOG_WIDTH),
          height: Math.max(layoutViewport.height, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT),
        };
        defaultFrameRef.current = null;
        applyNormalizedState(fullSize, { x: 0, y: 0 });
      } else if (mode === 'maximize') {
        const size = getPresetSize('maximize', layoutViewport);
        const position = initialPosition(size, layoutViewport);
        const normalized = normalizeDialogState(size, position, layoutViewport, {
          enforceTopLeftMargin: false,
          minPosition: 0,
          clampSizeToViewport: true,
        });
        defaultFrameRef.current = null;
        applyNormalizedState(normalized.size, normalized.position);
      } else {
        const size = restoreSize ?? getPresetSize('normal', viewport);
        const position = restorePosition ?? initialPosition(size, viewport);
        const normalized = normalizeDialogState(size, position, viewport, {
          enforceTopLeftMargin: true,
        });
        applyNormalizedState(normalized.size, normalized.position);
      }

      persistDisplayMode(mode);
      transitionSourceRef.current = null;
      transitionInFlightRef.current = null;
    },
    [allowFullScreen, displayMode, persistDisplayMode, persistPosition, persistSize, urlMode]
  );

  useEffect(() => {
    if (transitionInFlightRef.current) return;
    if (urlMode !== displayMode) {
      void transitionDisplayMode(urlMode, { source: 'url-sync' });
    }
  }, [displayMode, transitionDisplayMode, urlMode]);

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

      const shouldRecenter =
        displayMode === 'normal' &&
        defaultFrameRef.current &&
        sizesEqual(dialogSizeRef.current, defaultFrameRef.current.size) &&
        positionsEqual(dialogPositionRef.current, defaultFrameRef.current.position);

      if (shouldRecenter) {
        const recentered = normalizeDialogState(
          targetSize,
          initialPosition(targetSize, viewport),
          viewport,
          options
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
      // When the user manually resizes from maximize, transition to normal
      const nextDisplayMode = displayMode === 'maximize' ? 'normal' : displayMode;
      if (displayMode === 'maximize') {
        persistDisplayMode('normal');
      }
      const viewport = getViewportSize();
      const normalized = normalizeDialogState(next, dialogPositionRef.current, viewport, {
        enforceTopLeftMargin: nextDisplayMode === 'normal',
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
    [displayMode, persistDisplayMode, persistPosition, persistSize]
  );

  const handlePositionChange = useCallback(
    (next?: DialogPosition) => {
      if (!next) return;
      defaultFrameRef.current = null;
      // When the user manually moves from maximize, transition to normal
      const nextDisplayMode = displayMode === 'maximize' ? 'normal' : displayMode;
      if (displayMode === 'maximize') {
        persistDisplayMode('normal');
      }
      const viewport = getViewportSize();
      const normalized = normalizeDialogState(dialogSizeRef.current, next, viewport, {
        enforceTopLeftMargin: nextDisplayMode === 'normal',
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
    [displayMode, persistDisplayMode, persistPosition, persistSize]
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
