import type React from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Box } from '@mui/material';
import { ThemeProvider, createTheme, useTheme } from '@mui/material/styles';
import { HeadlessMultiStepDialog } from './MultiStepDialog.js';
import {
  FRAME_CONSTANTS,
  getViewportSize,
  normalizeDialogState,
  initialPosition,
} from './frameHelpers.js';
import type {
  HeadlessMultiStepDialogProps,
  MultiStepDialogPosition,
  MultiStepDialogSize,
} from './types.js';
import { getDialogSurfaceColor } from '../utils/dialogSurfaceColor.js';
import { useDialogInteractionGuards } from '~/hooks/useDialogInteractionGuards.js';

type ResizeDirection =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

interface ResizeHandleConfig {
  key: string;
  direction: ResizeDirection;
  style: React.CSSProperties;
}

export interface DialogOverlayFrameProps {
  headlessProps: HeadlessMultiStepDialogProps<any>;
  defaultSize?: MultiStepDialogSize;
  enableDrag?: boolean;
  enableResize?: boolean;
  backdropZIndex?: number;
  /** Override backdrop color; defaults to dark translucent overlay. */
  backdropColor?: string;
}

const DEFAULT_SIZE: MultiStepDialogSize = { width: 960, height: 640 };

export const DialogOverlayFrame: React.FC<DialogOverlayFrameProps> = ({
  headlessProps,
  defaultSize = DEFAULT_SIZE,
  enableDrag = true,
  enableResize = true,
  backdropZIndex,
  backdropColor,
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
    start: MultiStepDialogPosition;
    size: MultiStepDialogSize;
    displayMode: 'normal' | 'maximize' | 'full-screen';
  } | null>(null);

  const resizeStateRef = useRef<{
    pointerId: number;
    originX: number;
    originY: number;
    startSize: MultiStepDialogSize;
    startPosition: MultiStepDialogPosition;
    displayMode: 'normal' | 'maximize' | 'full-screen';
    direction: ResizeDirection;
  } | null>(null);

  const effectiveDisplayMode = headlessProps.displayMode ?? 'normal';
  // const effectiveSize = headlessProps.size ?? defaultSize;
  const fallbackPosition = useMemo(() => {
    if (headlessProps.position) {
      return headlessProps.position;
    }
    if (!isBrowser) {
      return { x: 0, y: 0 } satisfies MultiStepDialogPosition;
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
      const proposed: MultiStepDialogPosition = {
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

  const handleResizePointerDown = useCallback((event: React.PointerEvent<HTMLElement>, direction: ResizeDirection) => {
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
      direction,
    };

    guards.registerDragStart();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const state = resizeStateRef.current;
      if (!state || moveEvent.pointerId !== pointerId) return;
      const viewport = getViewportSize();
      const deltaX = moveEvent.clientX - state.originX;
      const deltaY = moveEvent.clientY - state.originY;

      let nextWidth = state.startSize.width;
      let nextHeight = state.startSize.height;
      let nextX = state.startPosition.x;
      let nextY = state.startPosition.y;

      if (state.direction.includes('right')) {
        nextWidth = state.startSize.width + deltaX;
      }
      if (state.direction.includes('left')) {
        nextWidth = state.startSize.width - deltaX;
        nextX = state.startPosition.x + deltaX;
      }
      if (state.direction.includes('bottom')) {
        nextHeight = state.startSize.height + deltaY;
      }
      if (state.direction.includes('top')) {
        nextHeight = state.startSize.height - deltaY;
        nextY = state.startPosition.y + deltaY;
      }

      const proposedSize: MultiStepDialogSize = {
        width: Math.max(nextWidth, FRAME_CONSTANTS.MIN_DIALOG_WIDTH),
        height: Math.max(nextHeight, FRAME_CONSTANTS.MIN_DIALOG_HEIGHT),
      };

      const proposedPosition: MultiStepDialogPosition = {
        x: nextX,
        y: nextY,
      };

      const normalized = normalizeDialogState(
        proposedSize,
        proposedPosition,
        viewport,
        {
          enforceTopLeftMargin: state.displayMode === 'normal',
          minPosition: state.displayMode === 'normal' ? 0 : FRAME_CONSTANTS.NON_STANDARD_MARGIN,
          clampSizeToViewport: true,
        },
      );

      headlessProps.onSizeChange?.(normalized.size);
      headlessProps.onPositionChange?.(normalized.position);
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

  const makeResizePointerDown = useCallback((direction: ResizeDirection) => (
    (event: React.PointerEvent<HTMLElement>) => handleResizePointerDown(event, direction)
  ), [handleResizePointerDown]);

  const resizeHandles = useMemo(() => {
    if (!enableResize) return [] as ResizeHandleConfig[];
    const transparent = { backgroundColor: 'transparent', touchAction: 'none' } as const;
    const base: Array<ResizeHandleConfig> = [
      { key: 'top', direction: 'top', style: { top: -4, left: '12px', right: '12px', height: 12, cursor: 'ns-resize', ...transparent } },
      { key: 'bottom', direction: 'bottom', style: { bottom: -4, left: '12px', right: '12px', height: 12, cursor: 'ns-resize', ...transparent } },
      { key: 'left', direction: 'left', style: { left: -4, top: '12px', bottom: '12px', width: 12, cursor: 'ew-resize', ...transparent } },
      { key: 'right', direction: 'right', style: { right: -4, top: '12px', bottom: '12px', width: 12, cursor: 'ew-resize', ...transparent } },
      { key: 'top-left', direction: 'top-left', style: { top: -4, left: -4, width: 16, height: 16, cursor: 'nwse-resize', ...transparent } },
      { key: 'top-right', direction: 'top-right', style: { top: -4, right: -4, width: 16, height: 16, cursor: 'nesw-resize', ...transparent } },
      { key: 'bottom-left', direction: 'bottom-left', style: { bottom: -4, left: -4, width: 16, height: 16, cursor: 'nesw-resize', ...transparent } },
      { key: 'bottom-right', direction: 'bottom-right', style: { bottom: -4, right: -4, width: 16, height: 16, cursor: 'nwse-resize', ...transparent } },
    ];
    return base;
  }, [enableResize]);

  const bottomRightResize = useMemo(() => (
    enableResize ? makeResizePointerDown('bottom-right') : undefined
  ), [enableResize, makeResizePointerDown]);

  const augmentedHeadlessProps = useMemo<HeadlessMultiStepDialogProps<any>>(() => ({
    ...headlessProps,
    size: headlessProps.size ?? defaultSize,
    position: headlessProps.position ?? fallbackPosition,
    displayMode: headlessProps.displayMode ?? 'normal',
    onDragHandlePointerDown: enableDrag ? handleDragPointerDown : undefined,
    onResizeHandlePointerDown: bottomRightResize,
  }), [bottomRightResize, defaultSize, enableDrag, fallbackPosition, handleDragPointerDown, headlessProps]);

  const handleBackdropPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    event.stopPropagation();
    guards.handleBackdropClick();
  }, [guards]);

  const fullScreen = augmentedHeadlessProps.displayMode === 'full-screen';
  const dialogSize = augmentedHeadlessProps.size ?? defaultSize;
  const dialogPosition = augmentedHeadlessProps.position ?? fallbackPosition;
  const outerTheme = useTheme();
  const dialogTheme = useMemo(
    () => createTheme({
      ...outerTheme,
      palette: {
        ...outerTheme.palette,
        background: {
          ...outerTheme.palette.background,
          // Match header/footer base tone for content as requested
          paper: getDialogSurfaceColor(outerTheme),
        },
      },
    }),
    [outerTheme],
  );

  if (!headlessProps.open) {
    return null;
  }

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
        backgroundColor: getDialogSurfaceColor(theme),
        transition: theme.transitions.create(['top', 'left', 'width', 'height'], { duration: theme.transitions.duration.shortest }),
      })}
      role="dialog"
      aria-modal="true"
    >
      <ThemeProvider theme={dialogTheme}>
        <HeadlessMultiStepDialog {...augmentedHeadlessProps} />
      </ThemeProvider>
      {enableResize && !fullScreen && resizeHandles.map((handle) => (
        <Box
          key={handle.key}
          sx={{
            position: 'absolute',
            zIndex: 1,
            ...handle.style,
          }}
          onPointerDown={makeResizePointerDown(handle.direction)}
        />
      ))}
    </Box>
  );

  const dialogNode = (
    <Box
      sx={(theme) => ({
        position: 'fixed',
        inset: 0,
        zIndex: backdropZIndex ?? theme.zIndex.modal + 10,
        backgroundColor: backdropColor ?? 'rgba(9, 12, 28, 0.45)',
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
