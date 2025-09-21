import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WheelEvent as ReactWheelEvent } from 'react';
import type {
  DialogDisplayMode,
  HeadlessMultiStepDialogProps,
  MultiDialogPosition,
  MultiDialogSize,
  StepComponentDescriptor,
  StepNavigationEvent,
} from './types.js';

/**
 * Manage active step index and translate dialog navigation events into index updates.
 */
export function useHeadlessStepNavigation(options: {
  stepCount: number;
  initialIndex?: number;
  onStepChange?: (nextIndex: number, event: StepNavigationEvent) => void;
}) {
  const { stepCount, initialIndex = 0, onStepChange } = options;
  const [activeStepIndex, setActiveStepIndex] = useState(() => clampIndex(initialIndex, stepCount));

  const setIndex = useCallback(
    (next: number, event: StepNavigationEvent) => {
      const clamped = clampIndex(next, stepCount);
      setActiveStepIndex(clamped);
      onStepChange?.(clamped, event);
    },
    [stepCount, onStepChange],
  );

  const handleNavigate = useCallback(
    (event: StepNavigationEvent) => {
      switch (event.type) {
        case 'direct':
          setIndex(event.targetIndex, event);
          break;
        case 'next':
          setIndex(activeStepIndex + 1, event);
          break;
        case 'back':
          setIndex(activeStepIndex - 1, event);
          break;
      }
    },
    [activeStepIndex, setIndex],
  );

  const dialogProps = useMemo<Pick<HeadlessMultiStepDialogProps<any>, 'activeStepIndex' | 'onStepNavigate'>>(
    () => ({
      activeStepIndex,
      onStepNavigate: handleNavigate,
    }),
    [activeStepIndex, handleNavigate],
  );

  return { activeStepIndex, setActiveStepIndex: setIndex, dialogProps };
}

function clampIndex(index: number, length: number) {
  if (length <= 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
}

/**
 * Manage dialog frame (position, size, display mode, header/footer visibility).
 * Consumers can persist these values outside if necessary via the provided setters.
 */
export function useHeadlessDialogFrame(options?: {
  initialPosition?: MultiDialogPosition;
  initialSize?: MultiDialogSize;
  initialDisplayMode?: DialogDisplayMode;
  onDisplayModeChange?: (mode: DialogDisplayMode) => void;
}) {
  const {
    initialPosition = { x: 80, y: 80 },
    initialSize = { width: 960, height: 640 },
    initialDisplayMode = 'normal',
    onDisplayModeChange,
  } = options ?? {};

  const [position, setPosition] = useState<MultiDialogPosition>(initialPosition);
  const [size, setSize] = useState<MultiDialogSize>(initialSize);
  const [displayMode, setDisplayMode] = useState<DialogDisplayMode>(initialDisplayMode);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [footerVisible, setFooterVisible] = useState(true);

  const handleDisplayMode = useCallback(
    (mode: DialogDisplayMode) => {
      setDisplayMode(mode);
      onDisplayModeChange?.(mode);
    },
    [onDisplayModeChange],
  );

  const frameProps = useMemo<Pick<HeadlessMultiStepDialogProps<any>,
    'position' | 'onPositionChange' | 'size' | 'onSizeChange' | 'displayMode' | 'onDisplayModeChange' |
    'headerDisplayMode' | 'footerDisplayMode' | 'onHeaderVisibilityChange' | 'onFooterVisibilityChange'
  >>(() => ({
    position,
    onPositionChange: setPosition,
    size,
    onSizeChange: setSize,
    displayMode,
    onDisplayModeChange: handleDisplayMode,
    headerDisplayMode: headerVisible ? 'visible' : 'hidden',
    footerDisplayMode: footerVisible ? 'visible' : 'hidden',
    onHeaderVisibilityChange: setHeaderVisible,
    onFooterVisibilityChange: setFooterVisible,
  }), [position, size, displayMode, headerVisible, footerVisible, handleDisplayMode]);

  return {
    position,
    setPosition,
    size,
    setSize,
    displayMode,
    setDisplayMode: handleDisplayMode,
    headerVisible,
    setHeaderVisible,
    footerVisible,
    setFooterVisible,
    frameProps,
  };
}

/** Track dirty state explicitly. */
export function useHeadlessDirtyFlag(initial = false) {
  const [isDirty, setDirty] = useState(initial);

  const markDirty = useCallback(() => setDirty(true), []);
  const resetDirty = useCallback(() => setDirty(false), []);

  return { isDirty, markDirty, resetDirty, setDirty };
}

/**
 * Convenience hook to memoise step descriptors.
 */
export function useHeadlessStepComponents<TData>(
  steps: Array<StepComponentDescriptor<TData>>,
) {
  return useMemo(() => steps as ReadonlyArray<StepComponentDescriptor<TData>>, [steps]);
}

interface DialogInteractionGuardsOptions {
  onBackdropClick?: () => void;
  backdropIgnoreDelayMs?: number;
  stopWheelPropagation?: boolean;
}

/**
 * Provide reusable guards to keep front-most dialogs from leaking interactions
 * (wheel/drag) to underlying content and to avoid inadvertent backdrop closes
 * right after drag/resize gestures.
 */
export function useDialogInteractionGuards(options?: DialogInteractionGuardsOptions) {
  const {
    onBackdropClick,
    backdropIgnoreDelayMs = 0,
    stopWheelPropagation = true,
  } = options ?? {};

  const draggingRef = useRef(false);
  const ignoreBackdropClickRef = useRef(false);
  const ignoreBackdropTimeoutRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (ignoreBackdropTimeoutRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(ignoreBackdropTimeoutRef.current);
      ignoreBackdropTimeoutRef.current = null;
    }
  }, []);

  const scheduleBackdropClickIgnore = useCallback(() => {
    if (typeof window === 'undefined') {
      ignoreBackdropClickRef.current = false;
      ignoreBackdropTimeoutRef.current = null;
      return;
    }

    ignoreBackdropClickRef.current = true;
    if (ignoreBackdropTimeoutRef.current !== null) {
      window.clearTimeout(ignoreBackdropTimeoutRef.current);
    }
    ignoreBackdropTimeoutRef.current = window.setTimeout(() => {
      ignoreBackdropClickRef.current = false;
      ignoreBackdropTimeoutRef.current = null;
    }, Math.max(backdropIgnoreDelayMs, 0));
  }, [backdropIgnoreDelayMs]);

  const registerDragStart = useCallback(() => {
    draggingRef.current = true;
  }, []);

  const registerDragEnd = useCallback(() => {
    draggingRef.current = false;
    scheduleBackdropClickIgnore();
  }, [scheduleBackdropClickIgnore]);

  const handleBackdropClick = useCallback(() => {
    if (draggingRef.current || ignoreBackdropClickRef.current) {
      return;
    }
    onBackdropClick?.();
  }, [onBackdropClick]);

  const handleWheelCapture = useCallback((event: ReactWheelEvent) => {
    if (!stopWheelPropagation) return;
    if (!draggingRef.current) {
      event.stopPropagation();
    }
  }, [stopWheelPropagation]);

  return {
    registerDragStart,
    registerDragEnd,
    handleBackdropClick,
    handleWheelCapture,
    isDraggingRef: draggingRef,
  } as const;
}
