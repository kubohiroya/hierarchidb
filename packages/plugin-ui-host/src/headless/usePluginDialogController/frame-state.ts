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
}

const parseDisplayMode = (mode: string | undefined): DialogDisplayMode | undefined => {
  switch (mode) {
    case 'full':
      return 'full-screen';
    case 'maximize':
      return 'maximize';
    case 'normal':
      return 'normal';
    default:
      return undefined;
  }
};

const toUrlMode = (mode: DialogDisplayMode): string => {
  switch (mode) {
    case 'full-screen':
      return 'full';
    case 'maximize':
      return 'maximize';
    default:
      return 'normal';
  }
};

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
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
  const writingRef = useRef(false);

  const readDialogPathState = useCallback(() => {
    if (!isBrowser) return { mode: undefined, step: undefined };
    const hash = window.location.hash ?? '';
    const usesHashRouting = hash.startsWith('#/');
    const pathWithQuery = usesHashRouting ? hash.slice(1) : window.location.pathname;
    const [pathOnly] = pathWithQuery.split('?');
    const normalizedPath = pathOnly?.startsWith('/') ? pathOnly : `/${pathOnly}`;
    const segments = normalizedPath.split('/').filter(Boolean);
    const tIndex = segments.indexOf('t');
    if (tIndex < 0 || segments.length < tIndex + 6) {
      return { mode: undefined, step: undefined };
    }
    const modeSegment = segments[tIndex + 6];
    const stepSegment = segments[tIndex + 7];
    const mode = modeSegment;
    const step = stepSegment !== undefined ? Number(stepSegment) : undefined;
    return {
      mode,
      step: Number.isFinite(step) ? step : undefined,
    };
  }, [isBrowser]);

  const [{ mode: urlMode, step: urlStep }, setUrlState] = useState<{
    mode: DialogDisplayMode;
    step: number;
  }>(() => {
    const { mode, step } = readDialogPathState();
    return {
      mode: parseDisplayMode(mode) ?? 'normal',
      step: step ?? Math.max(initialStep, 1),
    };
  });

  const updateDialogPath = useCallback(
    (nextMode: DialogDisplayMode, nextStep: number) => {
      if (!isBrowser) return;
      const url = new URL(window.location.href);
      const hash = url.hash ?? '';
      const usesHashRouting = hash.startsWith('#/');
      const pathWithQuery = usesHashRouting ? hash.slice(1) : url.pathname;
      const [pathOnly, hashQuery = ''] = pathWithQuery.split('?');
      const normalizedPath = pathOnly?.startsWith('/') ? pathOnly : `/${pathOnly}`;
      const segments = normalizedPath.split('/').filter(Boolean);
      const tIndex = segments.indexOf('t');
      if (tIndex < 0 || segments.length < tIndex + 6) return;
      const baseSegments = segments.slice(0, tIndex + 6);
      const nextSegments = [...baseSegments, toUrlMode(nextMode), String(nextStep)];
      const nextPath = `/${nextSegments.join('/')}`;

      if (usesHashRouting) {
        const hashSearch = new URLSearchParams(hashQuery);
        hashSearch.delete('step');
        hashSearch.delete('mode');
        const querySuffix = hashSearch.toString();
        url.hash = `#${nextPath}${querySuffix.length > 0 ? `?${querySuffix}` : ''}`;
      } else {
        url.pathname = nextPath;
        const search = new URLSearchParams(url.search);
        search.delete('step');
        search.delete('mode');
        url.search = search.toString();
      }

      writingRef.current = true;
      window.history.replaceState(null, '', url);
      setTimeout(() => {
        writingRef.current = false;
      }, 0);
    },
    [isBrowser]
  );

  useEffect(() => {
    updateDialogPath(urlMode, urlStep);
  }, [updateDialogPath, urlMode, urlStep]);

  useEffect(() => {
    if (!isBrowser) return;
    const onPopState = () => {
      if (writingRef.current) return;
      const { mode, step } = readDialogPathState();
      const parsedMode = parseDisplayMode(mode);
      setUrlState((prev) => ({
        mode: parsedMode ?? prev.mode,
        step: step ?? prev.step,
      }));
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [isBrowser, readDialogPathState]);

  useEffect(() => {
    if (!isBrowser || !forceInitialStep) return;
    const { mode, step } = readDialogPathState();
    const parsedMode = parseDisplayMode(mode);
    const fallbackStep = Math.max(initialStep, 1);
    setUrlState((prev) => ({
      mode: parsedMode ?? prev.mode,
      step: step ?? fallbackStep,
    }));
  }, [forceInitialStep, initialStep, isBrowser, readDialogPathState]);

  const [activeStepIndex, setActiveStepIndex] = useState(toInternalStepIndex(initialStep));
  useEffect(() => {
    if (typeof urlStep === 'number') {
      setActiveStepIndex(clampIndex(toInternalStepIndex(urlStep), Number.POSITIVE_INFINITY));
    }
  }, [urlStep]);

  const setUrlStepInternal = useCallback((nextIndex: number) => {
    const nextStep = toStepNumber(nextIndex);
    setUrlState((prev) => (prev.step === nextStep ? prev : { ...prev, step: nextStep }));
  }, []);

  const initialFrame = (() => {
    const viewport = getViewportSize();
    const size = getPresetSize('normal', viewport);
    return normalizeDialogState(size, initialPosition(size, viewport), viewport, {
      enforceTopLeftMargin: true,
    });
  })();

  const defaultFrameRef = useRef<typeof initialFrame | null>(initialFrame);

  const [displayMode, setDisplayModeState] = useState<DialogDisplayMode>(urlMode);
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
    setUrlState((prev) => (prev.mode === displayMode ? prev : { ...prev, mode: displayMode }));
  }, [displayMode]);

  const persistDisplayMode = useCallback((value: DialogDisplayMode) => {
    setDisplayModeState(value);
    setUrlState((prev) => (prev.mode === value ? prev : { ...prev, mode: value }));
  }, []);

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
    if (urlMode !== displayMode) {
      void transitionDisplayMode(urlMode);
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

      const shouldRecenter =
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
