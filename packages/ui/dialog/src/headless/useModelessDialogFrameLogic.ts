import { createElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';
import { FRAME_CONSTANTS } from './frameHelpers.js';
import type { HeadlessDialogHeaderProps, HeadlessDialogProps } from './types.js';
import { getDialogSurfaceColor } from '../utils/dialogSurfaceColor.js';
import { useDialogInteractionGuards } from '../hooks/useDialogInteractionGuards.js';

const DEFAULT_DIALOG_SIZE = { width: 960, height: 640 } as const;
const MINIMIZED_HEIGHT = 56;

type ResizeHorizontal = 'left' | 'right' | null;
type ResizeVertical = 'top' | 'bottom' | null;

export interface ResizeDirection {
  horizontal: ResizeHorizontal;
  vertical: ResizeVertical;
}

export interface UseModelessDialogFrameLogicParams<TData> {
  headlessProps: HeadlessDialogProps<TData>;
  frameSx?: SxProps<Theme>;
  backdropIgnoreDelayMs: number;
  stopWheelPropagation: boolean;
  transitionDuration?: number;
  frameless: boolean;
  transparent: boolean;
  onRequestFocus?: () => void;
  minimizedHeight?: number;
}

export function useModelessDialogFrameLogic<TData>({
  headlessProps,
  frameSx,
  backdropIgnoreDelayMs,
  stopWheelPropagation,
  transitionDuration,
  frameless,
  transparent,
  onRequestFocus,
  minimizedHeight,
}: UseModelessDialogFrameLogicParams<TData>) {
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

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
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

  const handleDragPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
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

  const handleResizePointerDown = useCallback((direction: ResizeDirection, event: ReactPointerEvent<HTMLElement>) => {
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
    const WrappedHeader = (headerProps: HeadlessDialogHeaderProps<TData>) => {
      if (!isHeaderVisible) return null;
      if (!OriginalHeader) return null;
      return createElement(OriginalHeader, headerProps);
    };
    WrappedHeader.displayName = OriginalHeader?.displayName ?? OriginalHeader?.name ?? 'FramelessHeader';
    return WrappedHeader;
  }, [frameless, headlessProps.HeaderComponent, isHeaderVisible]);

  const augmentedHeadlessProps = useMemo(() => ({
    ...headlessProps,
    frameless,
    transparent,
    HeaderComponent: headerComponent,
    onDragHandlePointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      onRequestFocus?.();
      handleDragPointerDown(event);
      headlessProps.onDragHandlePointerDown?.(event);
    },
    onResizeHandlePointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      headlessProps.onResizeHandlePointerDown?.(event);
    },
  }), [handleDragPointerDown, headerComponent, headlessProps, frameless, onRequestFocus, transparent]);

  const defaultFrameSx = useMemo(() => (
    (activeTheme: Theme) => {
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
        borderRadius: fullScreen ? 0 : activeTheme.shape.borderRadius,
        boxShadow: fullScreen || (frameless && transparent) ? 'none' : activeTheme.shadows[8],
        overflow: 'hidden',
        backgroundColor: transparent ? 'transparent' : getDialogSurfaceColor(activeTheme),
        pointerEvents: 'auto',
        ...(isInteracting
          ? {
            transition: 'none',
            willChange: 'top, left, width, height',
          }
          : {
            transition: activeTheme.transitions.create(['top', 'left', 'width', 'height'], {
              duration: activeTheme.transitions.duration.shortest,
            }),
          }),
      } as const;
    }
  ), [collapsedHeight, frameless, fullScreen, isInteracting, isMinimized, position.x, position.y, size.height, size.width, transparent]);

  const combinedFrameSx = useMemo<SxProps<Theme>>(
    () => (frameSx
      ? ([defaultFrameSx, frameSx] as SxProps<Theme>)
      : defaultFrameSx),
    [defaultFrameSx, frameSx],
  );

  return {
    open,
    isBrowser,
    shouldAnimate,
    transitionTimeout,
    guards,
    fullScreen,
    isMinimized,
    handleKeyDown,
    handleDragPointerDown,
    handleResizePointerDown,
    augmentedHeadlessProps,
    combinedFrameSx,
  };
}
