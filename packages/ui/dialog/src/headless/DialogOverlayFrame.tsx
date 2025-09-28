import type React from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Box } from '@mui/material';
import { HeadlessMultiStepDialog } from './MultiStepDialog.js';
import {
  FRAME_CONSTANTS,
  getViewportSize,
  normalizeDialogState,
  initialPosition,
} from './frameHelpers.js';
import { useDialogInteractionGuards } from './hooks.js';
import type {
  HeadlessMultiStepDialogProps,
  MultiDialogPosition,
  MultiDialogSize,
} from './types.js';

export interface DialogOverlayFrameProps {
  headlessProps: HeadlessMultiStepDialogProps<any>;
  defaultSize?: MultiDialogSize;
  enableDrag?: boolean;
  enableResize?: boolean;
  backdropZIndex?: number;
}

const DEFAULT_SIZE: MultiDialogSize = { width: 960, height: 640 };

export const DialogOverlayFrame: React.FC<DialogOverlayFrameProps> = ({
  headlessProps,
  defaultSize = DEFAULT_SIZE,
  enableDrag = true,
  enableResize = true,
  backdropZIndex,
}) => {
  const isBrowser = typeof document !== 'undefined';
  const guards = useDialogInteractionGuards({
    onBackdropClick: () => headlessProps.onRequestClose?.('close'),
    backdropIgnoreDelayMs: 160,
  });

  useEffect(() => {
    if (!isBrowser) return;
    if (!headlessProps.open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [headlessProps.open, isBrowser]);

  const dragStateRef = useRef<{
    pointerId: number;
    originX: number;
    originY: number;
    start: MultiDialogPosition;
    size: MultiDialogSize;
    displayMode: 'normal' | 'maximize' | 'full-screen';
  } | null>(null);

  const resizeStateRef = useRef<{
    pointerId: number;
    originX: number;
    originY: number;
    startSize: MultiDialogSize;
    startPosition: MultiDialogPosition;
    displayMode: 'normal' | 'maximize' | 'full-screen';
  } | null>(null);

  const effectiveDisplayMode = headlessProps.displayMode ?? 'normal';
  // const effectiveSize = headlessProps.size ?? defaultSize;
  const fallbackPosition = useMemo(() => {
    if (headlessProps.position) {
      return headlessProps.position;
    }
    if (!isBrowser) {
      return { x: 0, y: 0 } satisfies MultiDialogPosition;
    }
    const viewport = getViewportSize();
    const preset = initialPosition(defaultSize, viewport);
    return preset;
  }, [defaultSize, headlessProps.position, isBrowser]);

  const handleDragPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (!enableDrag) return;
    if (effectiveDisplayMode === 'full-screen') return;
    if (!headlessProps.onPositionChange) return;
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const pointerId = event.pointerId;
    const startPosition = headlessProps.position ?? fallbackPosition;
    const sizeSnapshot = headlessProps.size ?? defaultSize;
    const modeSnapshot = headlessProps.displayMode ?? 'normal';

    dragStateRef.current = {
      pointerId,
      originX: event.clientX,
      originY: event.clientY,
      start: startPosition,
      size: sizeSnapshot,
      displayMode: modeSnapshot,
    };

    guards.registerDragStart();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state || moveEvent.pointerId !== pointerId) return;
      const viewport = getViewportSize();
      const proposed: MultiDialogPosition = {
        x: state.start.x + (moveEvent.clientX - state.originX),
        y: state.start.y + (moveEvent.clientY - state.originY),
      };
      const normalized = normalizeDialogState(
        state.size,
        proposed,
        viewport,
        {
          enforceTopLeftMargin: state.displayMode === 'normal',
          minPosition: state.displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
          clampSizeToViewport: state.displayMode !== 'full-screen',
        },
      );
      headlessProps.onPositionChange?.(normalized.position);
    };

    const handlePointerEnd = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
      dragStateRef.current = null;
      guards.registerDragEnd();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
  }, [enableDrag, effectiveDisplayMode, fallbackPosition, guards, headlessProps, defaultSize]);

  const handleResizePointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (!enableResize) return;
    if (effectiveDisplayMode === 'full-screen') return;
    if (!headlessProps.onSizeChange) return;
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const pointerId = event.pointerId;
    const sizeSnapshot = headlessProps.size ?? defaultSize;
    const positionSnapshot = headlessProps.position ?? fallbackPosition;
    const modeSnapshot = headlessProps.displayMode ?? 'normal';

    resizeStateRef.current = {
      pointerId,
      originX: event.clientX,
      originY: event.clientY,
      startSize: sizeSnapshot,
      startPosition: positionSnapshot,
      displayMode: modeSnapshot,
    };

    guards.registerDragStart();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const state = resizeStateRef.current;
      if (!state || moveEvent.pointerId !== pointerId) return;
      const viewport = getViewportSize();
      const width = Math.max(state.startSize.width + (moveEvent.clientX - state.originX), FRAME_CONSTANTS.MIN_DIALOG_WIDTH);
      const height = Math.max(state.startSize.height + (moveEvent.clientY - state.originY), FRAME_CONSTANTS.MIN_DIALOG_HEIGHT);
      const proposedSize: MultiDialogSize = { width, height };
      const normalized = normalizeDialogState(
        proposedSize,
        state.startPosition,
        viewport,
        {
          enforceTopLeftMargin: state.displayMode === 'normal',
          minPosition: state.displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
          clampSizeToViewport: true,
        },
      );
      headlessProps.onSizeChange?.(normalized.size);
      if (
        headlessProps.onPositionChange
        && (normalized.position.x !== state.startPosition.x || normalized.position.y !== state.startPosition.y)
      ) {
        headlessProps.onPositionChange(normalized.position);
      }
    };

    const handlePointerEnd = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
      resizeStateRef.current = null;
      guards.registerDragEnd();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
  }, [defaultSize, enableResize, fallbackPosition, guards, headlessProps, effectiveDisplayMode]);

  const augmentedHeadlessProps = useMemo<HeadlessMultiStepDialogProps<any>>(() => ({
    ...headlessProps,
    size: headlessProps.size ?? defaultSize,
    position: headlessProps.position ?? fallbackPosition,
    displayMode: headlessProps.displayMode ?? 'normal',
    onDragHandlePointerDown: enableDrag ? handleDragPointerDown : undefined,
    onResizeHandlePointerDown: enableResize ? handleResizePointerDown : undefined,
  }), [defaultSize, enableDrag, enableResize, fallbackPosition, handleDragPointerDown, handleResizePointerDown, headlessProps]);

  const handleBackdropPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    event.stopPropagation();
    guards.handleBackdropClick();
  }, [guards]);

  if (!headlessProps.open) {
    return null;
  }

  const fullScreen = augmentedHeadlessProps.displayMode === 'full-screen';
  const dialogSize = augmentedHeadlessProps.size ?? defaultSize;
  const dialogPosition = augmentedHeadlessProps.position ?? fallbackPosition;

  const frameNode = (
    <Box
      sx={(theme) => ({
        position: 'absolute',
        top: fullScreen ? 0 : dialogPosition.y,
        left: fullScreen ? 0 : dialogPosition.x,
        width: fullScreen ? '100%' : dialogSize.width,
        height: fullScreen ? '100%' : dialogSize.height,
        maxWidth: fullScreen ? '100%' : `calc(100vw - ${FRAME_CONSTANTS.NON_STANDARD_MARGIN * 2}px)`,
        maxHeight: fullScreen ? '100%' : `calc(100vh - ${FRAME_CONSTANTS.NON_STANDARD_MARGIN * 2}px)`,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: fullScreen ? 0 : theme.shape.borderRadius,
        boxShadow: fullScreen ? 'none' : theme.shadows[8],
        overflow: 'hidden',
        backgroundColor: theme.palette.background.paper,
        transition: theme.transitions.create(['top', 'left', 'width', 'height'], { duration: theme.transitions.duration.shortest }),
      })}
      role="dialog"
      aria-modal="true"
    >
      <HeadlessMultiStepDialog {...augmentedHeadlessProps} />
      {enableResize && !fullScreen && (
        <Box
          sx={{
            position: 'absolute',
            width: 16,
            height: 16,
            bottom: 0,
            right: 0,
            cursor: 'nwse-resize',
          }}
          onPointerDown={handleResizePointerDown}
        />
      )}
    </Box>
  );

  const dialogNode = (
    <Box
      sx={(theme) => ({
        position: 'fixed',
        inset: 0,
        zIndex: backdropZIndex ?? theme.zIndex.modal + 10,
        backgroundColor: 'rgba(9, 12, 28, 0.45)',
        backdropFilter: 'blur(2px)',
        pointerEvents: headlessProps.open ? 'auto' : 'none',
      })}
      role="presentation"
      onPointerDown={handleBackdropPointerDown}
      onWheelCapture={guards.handleWheelCapture}
    >
      {frameNode}
    </Box>
  );

  if (!isBrowser) {
    return dialogNode;
  }

  return createPortal(dialogNode, document.body);
};

DialogOverlayFrame.displayName = 'DialogOverlayFrame';
