/**
 * @file ModelessDialogFrame.tsx
 * @description Modeless dialog frame with drag/resize support and z-order control.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Fade } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';
import { createPortal } from 'react-dom';
import { FRAME_CONSTANTS } from './frameHelpers.js';
import { AbstractDialog } from './AbstractDialog.js';
import type { HeadlessDialogHeaderProps, HeadlessDialogProps } from './types.js';
import { getDialogSurfaceColor } from '~/utils/dialogSurfaceColor';
import { useDialogInteractionGuards } from '~/hooks/useDialogInteractionGuards';

export interface ModelessDialogFrameProps<TData> {
  headlessProps: HeadlessDialogProps<TData>;
  /** Additional styles applied to the dialog frame container. */
  frameSx?: SxProps<Theme>;
  /** Override z-index used for this dialog. */
  zIndex?: number;
  /** Custom delay (ms) to ignore accidental clicks after drag/resize. */
  backdropIgnoreDelayMs?: number;
  /** Whether to stop wheel propagation to underlying content (default: true). */
  stopWheelPropagation?: boolean;
  /** Render dialog in-place instead of portal mounting. */
  disablePortal?: boolean;
  /** Custom container for the portal. Defaults to document.body when available. */
  portalContainer?: Element | DocumentFragment | null;
  /** Duration (ms) for the fade transition when the dialog mounts/unmounts. */
  transitionDuration?: number;
  /** Hide dialog header and allow toggling via right-click on the dialog surface. */
  frameless?: boolean;
  /** Make the dialog content background transparent. */
  transparent?: boolean;
  /** Called when the dialog surface should move to the front. */
  onRequestFocus?: () => void;
  /** Fixed height (px) when minimized. */
  minimizedHeight?: number;
}

const DEFAULT_DIALOG_SIZE = { width: 960, height: 640 } as const;
const MINIMIZED_HEIGHT = 56;
const EDGE_HANDLE_THICKNESS = 12;
const EDGE_HANDLE_OFFSET = EDGE_HANDLE_THICKNESS / 2;
const CORNER_HANDLE_SIZE = 12;
const CORNER_HANDLE_OFFSET = CORNER_HANDLE_SIZE / 2;

type ResizeHorizontal = 'left' | 'right' | null;
type ResizeVertical = 'top' | 'bottom' | null;

interface ResizeDirection {
  horizontal: ResizeHorizontal;
  vertical: ResizeVertical;
}

export function ModelessDialogFrame<TData>(props: ModelessDialogFrameProps<TData>) {
  const {
    headlessProps,
    frameSx,
    zIndex,
    backdropIgnoreDelayMs = 160,
    stopWheelPropagation = true,
    disablePortal = false,
    portalContainer,
    transitionDuration,
    frameless = false,
    transparent = false,
    onRequestFocus,
    minimizedHeight,
  } = props;

  const { open, onRequestClose } = headlessProps;

  const isBrowser = typeof document !== 'undefined';
  const theme = useTheme();
  const fadeDuration = transitionDuration ?? theme.transitions.duration.shorter;
  const hasMountedRef = useRef(false);
  const lastOpenRef = useRef(open);
  useEffect(() => {
    hasMountedRef.current = true;
    lastOpenRef.current = open;
  }, [open]);
  const shouldAnimate = !hasMountedRef.current || lastOpenRef.current !== open;
  const transitionTimeout = shouldAnimate ? fadeDuration : 0;

  const [isInteracting, setIsInteracting] = useState(false);
  const isHeaderVisible = !frameless;

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!open) return;
    if (event.key !== 'Escape') return;

    event.stopPropagation();
    onRequestClose?.('close');
  }, [onRequestClose, open]);

  const displayMode = headlessProps.displayMode ?? 'normal';
  const isMinimized = headlessProps.isMinimized ?? false;
  const fullScreen = displayMode === 'full-screen' && !isMinimized;
  const position = headlessProps.position ?? { x: 0, y: 0 };
  const size = headlessProps.size ?? DEFAULT_DIALOG_SIZE;
  const collapsedHeight = Math.max(minimizedHeight ?? MINIMIZED_HEIGHT, 48);

  const guards = useDialogInteractionGuards({
    backdropIgnoreDelayMs,
    stopWheelPropagation,
  });

  const dragStateRef = useRef<{
    pointerId: number;
    originX: number;
    originY: number;
    start: { x: number; y: number };
  } | null>(null);

  const resizeStateRef = useRef<{
    pointerId: number;
    originX: number;
    originY: number;
    startSize: { width: number; height: number };
    startPosition: { x: number; y: number };
    direction: ResizeDirection;
  } | null>(null);

  const handleDragPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (fullScreen) return;
    if (!headlessProps.onPositionChange) return;
    const isPrimaryButton = event.button === 0;
    const isSecondaryButton = frameless && event.button === 2;
    if (!isPrimaryButton && !isSecondaryButton) return;

    event.preventDefault();
    event.stopPropagation();

    dragStateRef.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      start: { x: position.x, y: position.y },
    };

    setIsInteracting(true);
    guards.registerDragStart();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state || moveEvent.pointerId !== state.pointerId) return;
      const next = {
        x: state.start.x + (moveEvent.clientX - state.originX),
        y: state.start.y + (moveEvent.clientY - state.originY),
      };
      headlessProps.onPositionChange?.(next);
    };

    const handlePointerEnd = (endEvent: PointerEvent) => {
      if (dragStateRef.current?.pointerId !== endEvent.pointerId) return;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
      dragStateRef.current = null;
      setIsInteracting(false);
      guards.registerDragEnd();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
  }, [frameless, fullScreen, guards, headlessProps, position.x, position.y]);

  const handleResizePointerDown = useCallback((direction: ResizeDirection, event: React.PointerEvent<HTMLElement>) => {
    if (fullScreen || isMinimized) return;
    if (!headlessProps.onSizeChange) return;
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    resizeStateRef.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      startSize: { width: size.width, height: size.height },
      startPosition: { x: position.x, y: position.y },
      direction,
    };

    setIsInteracting(true);
    guards.registerDragStart();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const state = resizeStateRef.current;
      if (!state || moveEvent.pointerId !== state.pointerId) return;

      const deltaX = moveEvent.clientX - state.originX;
      const deltaY = moveEvent.clientY - state.originY;

      const minWidth = FRAME_CONSTANTS.MIN_DIALOG_WIDTH;
      const minHeight = FRAME_CONSTANTS.MIN_DIALOG_HEIGHT;

      let nextWidth = state.startSize.width;
      let nextHeight = state.startSize.height;
      let nextX = state.startPosition.x;
      let nextY = state.startPosition.y;

      if (state.direction.horizontal === 'right') {
        nextWidth = Math.max(minWidth, state.startSize.width + deltaX);
      } else if (state.direction.horizontal === 'left') {
        const proposedWidth = state.startSize.width - deltaX;
        if (proposedWidth < minWidth) {
          nextWidth = minWidth;
          nextX = state.startPosition.x + (state.startSize.width - minWidth);
        } else {
          nextWidth = proposedWidth;
          nextX = state.startPosition.x + deltaX;
        }
      }

      if (state.direction.vertical === 'bottom') {
        nextHeight = Math.max(minHeight, state.startSize.height + deltaY);
      } else if (state.direction.vertical === 'top') {
        const proposedHeight = state.startSize.height - deltaY;
        if (proposedHeight < minHeight) {
          nextHeight = minHeight;
          nextY = state.startPosition.y + (state.startSize.height - minHeight);
        } else {
          nextHeight = proposedHeight;
          nextY = state.startPosition.y + deltaY;
        }
      }

      headlessProps.onSizeChange?.({ width: nextWidth, height: nextHeight });
      if (headlessProps.onPositionChange && (nextX !== state.startPosition.x || nextY !== state.startPosition.y)) {
        headlessProps.onPositionChange({ x: nextX, y: nextY });
      }
    };

    const handlePointerEnd = (endEvent: PointerEvent) => {
      if (resizeStateRef.current?.pointerId !== endEvent.pointerId) return;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
      resizeStateRef.current = null;
      setIsInteracting(false);
      guards.registerDragEnd();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
  }, [fullScreen, guards, headlessProps, isMinimized, position.x, position.y, size.height, size.width]);

  const headerComponent = useMemo(() => {
    if (!frameless) {
      return headlessProps.HeaderComponent;
    }
    const OriginalHeader = headlessProps.HeaderComponent;
    const WrappedHeader: React.FC<HeadlessDialogHeaderProps<TData>> = (headerProps) => {
      if (!isHeaderVisible) return null;
      if (!OriginalHeader) return null;
      return <OriginalHeader {...headerProps} />;
    };
    WrappedHeader.displayName = OriginalHeader?.displayName ?? OriginalHeader?.name ?? 'FramelessHeader';
    return WrappedHeader;
  }, [frameless, headlessProps.HeaderComponent, isHeaderVisible]);

  const augmentedHeadlessProps = useMemo(() => ({
    ...headlessProps,
    frameless,
    transparent,
    HeaderComponent: headerComponent,
    onDragHandlePointerDown: (event: React.PointerEvent<HTMLElement>) => {
      onRequestFocus?.();
      handleDragPointerDown(event);
      headlessProps.onDragHandlePointerDown?.(event);
    },
    onResizeHandlePointerDown: (event: React.PointerEvent<HTMLElement>) => {
      headlessProps.onResizeHandlePointerDown?.(event);
    },
  }), [handleDragPointerDown, headerComponent, headlessProps, onRequestFocus]);

  const defaultFrameSx = useMemo(() => (
    (theme: Theme) => {
      const height = fullScreen
        ? '100%'
        : isMinimized
          ? collapsedHeight
          : size.height;
      const maxHeight = fullScreen
        ? '100%'
        : isMinimized
          ? collapsedHeight
          : `calc(100vh - ${FRAME_CONSTANTS.NON_STANDARD_MARGIN * 2}px)`;
      return {
        position: 'absolute',
        top: fullScreen ? 0 : position.y,
        left: fullScreen ? 0 : position.x,
        width: fullScreen ? '100%' : size.width,
        height,
        maxWidth: fullScreen ? '100%' : `calc(100vw - ${FRAME_CONSTANTS.NON_STANDARD_MARGIN * 2}px)`,
        maxHeight,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: fullScreen ? 0 : theme.shape.borderRadius,
        boxShadow: fullScreen || (frameless && transparent) ? 'none' : theme.shadows[8],
        overflow: 'hidden',
        backgroundColor: transparent ? 'transparent' : getDialogSurfaceColor(theme),
        pointerEvents: 'auto',
        ...(isInteracting
          ? {
            transition: 'none',
            willChange: 'top, left, width, height',
          }
          : {
            transition: theme.transitions.create(['top', 'left', 'width', 'height'], {
              duration: theme.transitions.duration.shortest,
            }),
          }),
      } as const;
    }
  ), [collapsedHeight, fullScreen, frameless, isInteracting, isMinimized, position.x, position.y, size.height, size.width, transparent]);

  const combinedFrameSx = useMemo<SxProps<Theme>>(
    () => (frameSx
      ? ([defaultFrameSx, frameSx] as SxProps<Theme>)
      : defaultFrameSx),
    [defaultFrameSx, frameSx],
  );

  const frameNode = (
    <Box
      sx={combinedFrameSx}
      role="dialog"
      aria-modal={false}
      onKeyDown={handleKeyDown}
      onPointerDown={(event) => {
        onRequestFocus?.();
        if (frameless && event.button === 2) {
          handleDragPointerDown(event);
        }
      }}
      onWheelCapture={guards.handleWheelCapture}
      onContextMenu={(event) => {
        if (frameless) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <AbstractDialog {...augmentedHeadlessProps} />
      {!fullScreen && !isMinimized && (
        <>
          {[
            {
              key: 'top',
              direction: { horizontal: null, vertical: 'top' as ResizeVertical },
              sx: {
                top: -EDGE_HANDLE_OFFSET,
                left: 0,
                right: 0,
                height: EDGE_HANDLE_THICKNESS,
                cursor: 'ns-resize',
              },
            },
            {
              key: 'bottom',
              direction: { horizontal: null, vertical: 'bottom' as ResizeVertical },
              sx: {
                bottom: -EDGE_HANDLE_OFFSET,
                left: 0,
                right: 0,
                height: EDGE_HANDLE_THICKNESS,
                cursor: 'ns-resize',
              },
            },
            {
              key: 'left',
              direction: { horizontal: 'left' as ResizeHorizontal, vertical: null },
              sx: {
                top: 0,
                bottom: 0,
                left: -EDGE_HANDLE_OFFSET,
                width: EDGE_HANDLE_THICKNESS,
                cursor: 'ew-resize',
              },
            },
            {
              key: 'right',
              direction: { horizontal: 'right' as ResizeHorizontal, vertical: null },
              sx: {
                top: 0,
                bottom: 0,
                right: -EDGE_HANDLE_OFFSET,
                width: EDGE_HANDLE_THICKNESS,
                cursor: 'ew-resize',
              },
            },
            {
              key: 'top-left',
              direction: { horizontal: 'left' as ResizeHorizontal, vertical: 'top' as ResizeVertical },
              sx: {
                top: -CORNER_HANDLE_OFFSET,
                left: -CORNER_HANDLE_OFFSET,
                width: CORNER_HANDLE_SIZE,
                height: CORNER_HANDLE_SIZE,
                cursor: 'nwse-resize',
              },
            },
            {
              key: 'top-right',
              direction: { horizontal: 'right' as ResizeHorizontal, vertical: 'top' as ResizeVertical },
              sx: {
                top: -CORNER_HANDLE_OFFSET,
                right: -CORNER_HANDLE_OFFSET,
                width: CORNER_HANDLE_SIZE,
                height: CORNER_HANDLE_SIZE,
                cursor: 'nesw-resize',
              },
            },
            {
              key: 'bottom-left',
              direction: { horizontal: 'left' as ResizeHorizontal, vertical: 'bottom' as ResizeVertical },
              sx: {
                bottom: -CORNER_HANDLE_OFFSET,
                left: -CORNER_HANDLE_OFFSET,
                width: CORNER_HANDLE_SIZE,
                height: CORNER_HANDLE_SIZE,
                cursor: 'nesw-resize',
              },
            },
            {
              key: 'bottom-right',
              direction: { horizontal: 'right' as ResizeHorizontal, vertical: 'bottom' as ResizeVertical },
              sx: {
                bottom: -CORNER_HANDLE_OFFSET,
                right: -CORNER_HANDLE_OFFSET,
                width: CORNER_HANDLE_SIZE,
                height: CORNER_HANDLE_SIZE,
                cursor: 'nwse-resize',
              },
            },
          ].map((handle) => (
            <Box
              key={handle.key}
              sx={(theme) => ({
                position: 'absolute',
                zIndex: (theme.zIndex?.modal ?? 1300) + (handle.key.includes('-') ? 6 : 5),
                ...handle.sx,
              })}
              onPointerDown={(event) => {
                handleResizePointerDown(handle.direction, event);
                headlessProps.onResizeHandlePointerDown?.(event);
              }}
            />
          ))}
        </>
      )}
    </Box>
  );

  const portalTarget = portalContainer ?? (isBrowser ? document.body : null);
  const containerPosition = disablePortal ? 'absolute' : 'fixed';

  const dialogNode = (
    <Fade
      in={open}
      timeout={transitionTimeout}
      appear={shouldAnimate}
      mountOnEnter
      unmountOnExit
    >
      <Box
        sx={(theme) => ({
          position: containerPosition,
          inset: 0,
          zIndex: zIndex ?? (theme.zIndex?.modal ?? 1300) - 100,
          pointerEvents: 'none',
        })}
      >
        {frameNode}
      </Box>
    </Fade>
  );

  if (disablePortal || !isBrowser || !portalTarget) {
    return dialogNode;
  }

  return createPortal(dialogNode, portalTarget);
}

// ModelessDialog wrapper removed; use ModelessDialogFrame directly.
