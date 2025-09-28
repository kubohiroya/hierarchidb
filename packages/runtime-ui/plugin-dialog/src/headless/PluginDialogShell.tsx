import type React from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Box } from '@mui/material';
import {
  HeadlessMultiStepDialog,
  FRAME_CONSTANTS,
  getViewportSize,
  normalizeDialogState,
  useDialogInteractionGuards,
} from '@hierarchidb/ui-dialog';
import type { MultiDialogPosition, MultiDialogSize } from '@hierarchidb/ui-dialog';
import type { PluginDialogControllerOptions } from './usePluginDialogController.js';
import { usePluginDialogController } from './usePluginDialogController.js';

export type PluginDialogShellProps = PluginDialogControllerOptions;

const DEFAULT_DIALOG_SIZE: MultiDialogSize = { width: 960, height: 640 };

export const PluginDialogShell: React.FC<PluginDialogShellProps> = (props) => {
  const { headlessProps } = usePluginDialogController(props);
  const isBrowser = typeof document !== 'undefined';

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

  const guards = useDialogInteractionGuards({
    onBackdropClick: () => headlessProps.onRequestClose?.('close'),
    backdropIgnoreDelayMs: 160,
  });

  const displayMode = headlessProps.displayMode ?? 'normal';
  const fullScreen = displayMode === 'full-screen';
  const dialogPosition = headlessProps.position ?? { x: 0, y: 0 };
  const dialogSize = headlessProps.size ?? DEFAULT_DIALOG_SIZE;

  const handleDragPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (fullScreen) return;
    if (!headlessProps.onPositionChange) return;
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const pointerId = event.pointerId;
    const start = headlessProps.position ?? { x: 0, y: 0 };
    const sizeSnapshot = headlessProps.size ?? DEFAULT_DIALOG_SIZE;
    const modeSnapshot = headlessProps.displayMode ?? 'normal';

    dragStateRef.current = {
      pointerId,
      originX: event.clientX,
      originY: event.clientY,
      start,
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
  }, [fullScreen, headlessProps, guards]);

  const handleResizePointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (fullScreen) return;
    if (!headlessProps.onSizeChange) return;
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const pointerId = event.pointerId;
    const sizeSnapshot = headlessProps.size ?? DEFAULT_DIALOG_SIZE;
    const positionSnapshot = headlessProps.position ?? { x: 0, y: 0 };
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
      if (headlessProps.onPositionChange && (normalized.position.x !== state.startPosition.x || normalized.position.y !== state.startPosition.y)) {
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
  }, [fullScreen, headlessProps, guards]);

  const augmentedHeadlessProps = useMemo(() => ({
    ...headlessProps,
    onDragHandlePointerDown: handleDragPointerDown,
    onResizeHandlePointerDown: handleResizePointerDown,
  }), [headlessProps, handleDragPointerDown, handleResizePointerDown]);

  const handleBackdropPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    event.stopPropagation();
    guards.handleBackdropClick();
  }, [guards]);

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
      {!fullScreen && (
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
        zIndex: theme.zIndex.modal + 10,
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

  if (!headlessProps.open) {
    return null;
  }

  if (!isBrowser) {
    return dialogNode;
  }

  return createPortal(dialogNode, document.body);
};

PluginDialogShell.displayName = 'PluginDialogShell';
