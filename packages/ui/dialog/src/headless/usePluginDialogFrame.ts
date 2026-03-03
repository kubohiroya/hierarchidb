import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSObject, SxProps, Theme } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';
import { FRAME_CONSTANTS } from './frameHelpers.js';
import type { HeadlessDialogProps } from './types.js';
import { getDialogSurfaceColor } from '../utils/dialogSurfaceColor.js';
import { useDialogInteractionGuards } from '../hooks/useDialogInteractionGuards.js';
import type { PluginDialogFrameComponentProps } from './PluginDialogFrame.types.js';

const DEFAULT_DIALOG_SIZE = { width: 960, height: 640 } as const;
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

type DialogCountWindow = Window & {
  __HDB_DIALOG_OPEN_COUNT__?: number;
};

type ResizeHandleConfig = {
  key: string;
  direction: ResizeDirection;
  sx: CSSObject | ((theme: Theme) => CSSObject);
};

type PluginDialogFrameState<TData> = {
  open: boolean;
  frameless: boolean;
  fullScreen: boolean;
  allowResizeHandles: boolean;
  combinedFrameSx: SxProps<Theme>;
  combinedBackdropSx: SxProps<Theme>;
  augmentedHeadlessProps: HeadlessDialogProps<TData>;
  handleKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  handleFramePointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleContextMenu: (event: React.MouseEvent<HTMLDivElement>) => void;
  handleBackdropPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  handleWheelCapture: (event: React.WheelEvent<HTMLDivElement>) => void;
  handleResizePointerDown: (direction: ResizeDirection, event: React.PointerEvent<HTMLElement>) => void;
  portalTarget: Element | DocumentFragment | null;
  shouldAnimateBackdrop: boolean;
  backdropTimeout: number;
  resizeHandles: ResizeHandleConfig[];
  isBrowser: boolean;
};

const TEXT_EDITABLE_SELECTOR = [
  'input',
  'textarea',
  '[contenteditable="true"]',
  '[contenteditable=""]',
  '[role="textbox"]',
].join(', ');

function resolveTextEditableTarget(event: React.PointerEvent<HTMLDivElement>): HTMLElement | null {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return null;
  const candidate = target.closest<HTMLElement>(TEXT_EDITABLE_SELECTOR);
  if (!candidate) return null;
  if (candidate instanceof HTMLInputElement && (candidate.disabled || candidate.readOnly)) {
    return null;
  }
  if (candidate instanceof HTMLTextAreaElement && (candidate.disabled || candidate.readOnly)) {
    return null;
  }
  return candidate;
}

export function usePluginDialogFrame<TData>(
  props: PluginDialogFrameComponentProps<TData>
): PluginDialogFrameState<TData> {
  const {
    headlessProps,
    frameSx,
    backdropSx,
    zIndex,
    backdropIgnoreDelayMs = 160,
    stopWheelPropagation = true,
    disablePortal = false,
    portalContainer,
    transitionDuration,
    backdropDismissEnabled = true,
  } = props;

  const { open, onRequestClose } = headlessProps;
  const frameless = headlessProps.frameless ?? false;
  const transparent = headlessProps.transparent ?? false;

  const isBrowser = typeof document !== 'undefined';
  const theme = useTheme();
  const fadeDuration = transitionDuration ?? theme.transitions.duration.shorter;
  const hasMountedRef = useRef(false);
  const lastOpenRef = useRef(open);
  useEffect(() => {
    hasMountedRef.current = true;
    lastOpenRef.current = open;
  }, [open]);
  const shouldAnimateBackdrop = !hasMountedRef.current || lastOpenRef.current !== open;
  const backdropTimeout = shouldAnimateBackdrop ? fadeDuration : 0;

  const [isInteracting, setIsInteracting] = useState(false);
  const dialogOpenRegisteredRef = useRef(false);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!open) return;
    if (event.key !== 'Escape') return;

    event.stopPropagation();
    onRequestClose?.('close');
  }, [onRequestClose, open]);

  useEffect(() => {
    if (!isBrowser || !open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      onRequestClose?.('close');
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => {
      window.removeEventListener('keydown', handler, { capture: true });
    };
  }, [isBrowser, onRequestClose, open]);

  useEffect(() => {
    if (!isBrowser) return;
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isBrowser, open]);

  useEffect(() => {
    if (!isBrowser) return;
    const win = window as DialogCountWindow;
    const updateBodyState = () => {
      const count = Math.max(0, win.__HDB_DIALOG_OPEN_COUNT__ ?? 0);
      if (count > 0) {
        document.body.dataset.hdbDialogOpen = '1';
      } else {
        delete document.body.dataset.hdbDialogOpen;
      }
      window.dispatchEvent(
        new CustomEvent('hdb:dialog-visibility', {
          detail: { open: count > 0, count },
        })
      );
    };

    if (open && !dialogOpenRegisteredRef.current) {
      win.__HDB_DIALOG_OPEN_COUNT__ = (win.__HDB_DIALOG_OPEN_COUNT__ ?? 0) + 1;
      dialogOpenRegisteredRef.current = true;
      updateBodyState();
    }

    if (!open && dialogOpenRegisteredRef.current) {
      win.__HDB_DIALOG_OPEN_COUNT__ = Math.max(0, (win.__HDB_DIALOG_OPEN_COUNT__ ?? 1) - 1);
      dialogOpenRegisteredRef.current = false;
      updateBodyState();
    }

    return () => {
      if (!dialogOpenRegisteredRef.current) return;
      win.__HDB_DIALOG_OPEN_COUNT__ = Math.max(0, (win.__HDB_DIALOG_OPEN_COUNT__ ?? 1) - 1);
      dialogOpenRegisteredRef.current = false;
      updateBodyState();
    };
  }, [isBrowser, open]);

  const displayMode = headlessProps.displayMode ?? 'normal';
  const fullScreen = displayMode === 'full-screen';
  const allowResizeHandles = displayMode !== 'full-screen';
  const position = headlessProps.position ?? { x: 0, y: 0 };
  const size = headlessProps.size ?? DEFAULT_DIALOG_SIZE;

  const guards = useDialogInteractionGuards({
    onBackdropClick: backdropDismissEnabled
      ? () => {
          headlessProps.onRequestClose?.('close');
        }
      : undefined,
    backdropIgnoreDelayMs,
    stopWheelPropagation,
  });
  const registerDragEnd = guards.registerDragEnd;

  const dragStateRef = useRef<{
    pointerId: number;
    originX: number;
    originY: number;
    start: { x: number; y: number };
  } | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  const resizeStateRef = useRef<{
    pointerId: number;
    originX: number;
    originY: number;
    startSize: { width: number; height: number };
    startPosition: { x: number; y: number };
    direction: ResizeDirection;
  } | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  const resetInteractionState = useCallback(() => {
    const dragCleanup = dragCleanupRef.current;
    if (dragCleanup) {
      dragCleanup();
    }
    const resizeCleanup = resizeCleanupRef.current;
    if (resizeCleanup) {
      resizeCleanup();
    }
    dragStateRef.current = null;
    resizeStateRef.current = null;
    dragCleanupRef.current = null;
    resizeCleanupRef.current = null;
    setIsInteracting(false);
    registerDragEnd();
  }, [registerDragEnd]);

  useEffect(() => {
    resetInteractionState();
  }, [displayMode, resetInteractionState]);

  const handleDragPointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (fullScreen) return;
    if (!headlessProps.onPositionChange) return;
    const isPrimaryButton = event.button === 0;
    const isSecondaryButton = frameless && event.button === 2;
    if (!isPrimaryButton && !isSecondaryButton) return;

    if (event.detail > 1) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

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
      const state = dragStateRef.current;
      if (!state || state.pointerId !== endEvent.pointerId) return;
      const cleanup = dragCleanupRef.current;
      if (cleanup) {
        cleanup();
      }
      dragStateRef.current = null;
      dragCleanupRef.current = null;
      setIsInteracting(false);
      guards.registerDragEnd();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    dragCleanupRef.current = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [frameless, fullScreen, guards, headlessProps, position.x, position.y]);

  const handleResizePointerDown = useCallback((direction: ResizeDirection, event: React.PointerEvent<HTMLElement>) => {
    if (fullScreen) return;
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
      const state = resizeStateRef.current;
      if (!state || state.pointerId !== endEvent.pointerId) return;
      const cleanup = resizeCleanupRef.current;
      if (cleanup) {
        cleanup();
      }
      resizeStateRef.current = null;
      resizeCleanupRef.current = null;
      setIsInteracting(false);
      guards.registerDragEnd();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    resizeCleanupRef.current = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [fullScreen, guards, headlessProps, position.x, position.y, size.height, size.width]);

  const augmentedHeadlessProps = useMemo(() => ({
    ...headlessProps,
    frameless,
    transparent,
    onDragHandlePointerDown: (event: React.PointerEvent<HTMLElement>) => {
      handleDragPointerDown(event);
      headlessProps.onDragHandlePointerDown?.(event);
    },
    onResizeHandlePointerDown: (event: React.PointerEvent<HTMLElement>) => {
      headlessProps.onResizeHandlePointerDown?.(event);
    },
  }), [headlessProps, frameless, transparent, handleDragPointerDown]);

  const defaultFrameSx = useMemo(() => (
    (theme: Theme) => ({
      position: 'absolute',
      top: fullScreen ? 0 : position.y,
      left: fullScreen ? 0 : position.x,
      width: fullScreen ? '100%' : size.width,
      height: fullScreen ? '100%' : size.height,
      maxWidth: fullScreen ? '100%' : `calc(100vw - ${FRAME_CONSTANTS.NON_STANDARD_MARGIN * 2}px)`,
      maxHeight: fullScreen ? '100%' : `calc(100vh - ${FRAME_CONSTANTS.NON_STANDARD_MARGIN * 2}px)`,
      display: 'flex',
      flexDirection: 'column',
      borderRadius: fullScreen ? 0 : theme.shape.borderRadius,
      boxShadow: fullScreen || (frameless && transparent) ? 'none' : theme.shadows[8],
      overflow: 'hidden',
      backgroundColor: transparent ? 'transparent' : getDialogSurfaceColor(theme),
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
    })
  ), [fullScreen, frameless, isInteracting, position.x, position.y, size.height, size.width, transparent]);

  const combinedFrameSx = useMemo<SxProps<Theme>>(() => {
    if (!frameSx) return defaultFrameSx;
    const extra = Array.isArray(frameSx) ? frameSx : [frameSx];
    return [defaultFrameSx, ...extra] as SxProps<Theme>;
  }, [defaultFrameSx, frameSx]);

  const defaultBackdropSx = useMemo(() => (
    (theme: Theme) => ({
      position: 'fixed',
      inset: 0,
      zIndex: zIndex ?? theme.zIndex.modal,
      backgroundColor: 'rgba(9, 12, 28, 0.15)',
      backdropFilter: 'blur(1px)',
      pointerEvents: open ? 'auto' : 'none',
    })
  ), [open, zIndex]);

  const combinedBackdropSx = useMemo<SxProps<Theme>>(() => {
    if (!backdropSx) return defaultBackdropSx;
    const extra = Array.isArray(backdropSx) ? backdropSx : [backdropSx];
    return [defaultBackdropSx, ...extra] as SxProps<Theme>;
  }, [defaultBackdropSx, backdropSx]);

  const resizeHandles = useMemo<ResizeHandleConfig[]>(() => ([
    {
      key: 'top',
      direction: { horizontal: null, vertical: 'top' },
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
      direction: { horizontal: null, vertical: 'bottom' },
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
      direction: { horizontal: 'left', vertical: null },
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
      direction: { horizontal: 'right', vertical: null },
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
      direction: { horizontal: 'left', vertical: 'top' },
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
      direction: { horizontal: 'right', vertical: 'top' },
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
      direction: { horizontal: 'left', vertical: 'bottom' },
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
      direction: { horizontal: 'right', vertical: 'bottom' },
      sx: {
        bottom: -CORNER_HANDLE_OFFSET,
        right: -CORNER_HANDLE_OFFSET,
        width: CORNER_HANDLE_SIZE,
        height: CORNER_HANDLE_SIZE,
        cursor: 'nwse-resize',
      },
    },
  ]), []);

  const handleContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (frameless) {
      event.preventDefault();
    }
  }, [frameless]);

  const handleFramePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const textEditableTarget = resolveTextEditableTarget(event);
    if (textEditableTarget && !isInteracting) {
      queueMicrotask(() => {
        if (!textEditableTarget.isConnected) return;
        if (document.activeElement === textEditableTarget) return;
        try {
          textEditableTarget.focus({ preventScroll: true });
        } catch {
          textEditableTarget.focus();
        }
      });
    }

    if (frameless && event.button === 2) {
      handleDragPointerDown(event);
    }
  }, [frameless, handleDragPointerDown, isInteracting]);

  const handleBackdropPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    guards.handleBackdropClick();
  }, [guards]);

  const portalTarget = portalContainer ?? (isBrowser ? document.body : null);

  return {
    open,
    frameless,
    fullScreen,
    allowResizeHandles,
    combinedFrameSx,
    combinedBackdropSx,
    augmentedHeadlessProps,
    handleKeyDown,
    handleFramePointerDown,
    handleContextMenu,
    handleBackdropPointerDown,
    handleWheelCapture: guards.handleWheelCapture,
    handleResizePointerDown,
    portalTarget: disablePortal || !isBrowser ? null : portalTarget,
    shouldAnimateBackdrop,
    backdropTimeout,
    resizeHandles,
    isBrowser,
  };
}
