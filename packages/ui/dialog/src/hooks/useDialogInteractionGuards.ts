import {
  type CSSProperties,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useRef,
} from 'react';

interface DialogInteractionGuardsOptions {
  onBackdropClick?: () => void;
  backdropIgnoreDelayMs?: number;
  stopWheelPropagation?: boolean;
}

/**
 * Provide reusable guards to keep front-most console from leaking interactions
 * (wheel/drag) to underlying content and to avoid inadvertent backdrop closes
 * right after drag/resize gestures.
 */
export function useDialogInteractionGuards(options?: DialogInteractionGuardsOptions) {
  const { onBackdropClick, backdropIgnoreDelayMs = 0, stopWheelPropagation = true } = options ?? {};

  const draggingRef = useRef(false);
  const ignoreBackdropClickRef = useRef(false);
  const ignoreBackdropTimeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (ignoreBackdropTimeoutRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(ignoreBackdropTimeoutRef.current);
        ignoreBackdropTimeoutRef.current = null;
      }
    },
    []
  );

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
    ignoreBackdropTimeoutRef.current = window.setTimeout(
      () => {
        ignoreBackdropClickRef.current = false;
        ignoreBackdropTimeoutRef.current = null;
      },
      Math.max(backdropIgnoreDelayMs, 0)
    );
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

  const handleWheelCapture = useCallback(
    (event: ReactWheelEvent) => {
      if (!stopWheelPropagation) return;
      if (!draggingRef.current) {
        event.stopPropagation();
      }
    },
    [stopWheelPropagation]
  );

  return {
    registerDragStart,
    registerDragEnd,
    handleBackdropClick,
    handleWheelCapture,
    isDraggingRef: draggingRef,
    surfaceStyle: stopWheelPropagation
      ? ({ overscrollBehavior: 'contain' } as CSSProperties)
      : undefined,
    frameStyle: { overscrollBehavior: 'contain' } as CSSProperties,
  } as const;
}
