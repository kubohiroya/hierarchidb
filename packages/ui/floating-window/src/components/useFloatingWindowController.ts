/**
 * @file useFloatingWindowController.ts
 * @description Logic hook for FloatingWindow interactions and state.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { FloatingWindowProps, WindowState } from '~/types/WindowState';
import {
  DEFAULT_FLOATING_WINDOW_Z_INDEX,
  FLOATING_WINDOW_ROOT_ID,
  FloatingWindowPortalContext,
} from './FloatingWindowPortalProvider.js';

const ensureFloatingWindowRoot = (): HTMLElement | null => {
  if (typeof document === 'undefined') return null;
  const body = document.body;
  if (!body) return null;
  let root = document.getElementById(FLOATING_WINDOW_ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = FLOATING_WINDOW_ROOT_ID;
    root.style.position = 'fixed';
    root.style.inset = '0';
    root.style.pointerEvents = 'none';
    body.appendChild(root);
  }
  root.style.zIndex = String(DEFAULT_FLOATING_WINDOW_Z_INDEX);
  return root;
};

type FloatingWindowController = {
  portalRoot: HTMLElement | null;
  portalHostRef: React.MutableRefObject<HTMLDivElement | null>;
  windowRef: React.RefObject<HTMLDivElement | null>;
  state: WindowState;
  overlayActive: boolean;
  overlayCursor: string;
  windowStyle: React.CSSProperties;
  bringToFront: () => void;
  handleMouseDown: (event: React.PointerEvent) => void;
  handleResizeMouseDown: (direction: string) => (event: React.PointerEvent) => void;
  handleMinimize: () => void;
  handleFullscreen: () => void;
  handleClose: () => void;
  handleWindowMouseDownCapture: (event: React.PointerEvent) => void;
  handleTitleBarMouseDownCapture: (event: React.PointerEvent) => void;
  handleTitleBarDoubleClick: () => void;
  isProviderPortal: boolean;
};

export function useFloatingWindowController(
  props: FloatingWindowProps
): FloatingWindowController {
  const {
    initialState,
    onStateChange,
    onRequestFocus,
    onClose,
    minWidth = 200,
    minHeight = 100,
    maxWidth,
    maxHeight,
    resizable = true,
    draggable = true,
    style,
  } = props;

  const [overlayActive, setOverlayActive] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);

  const portalContext = React.useContext(FloatingWindowPortalContext);
  const portalRoot = portalContext.isProvider ? portalContext.root : ensureFloatingWindowRoot();
  const portalHostRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!portalRoot) return undefined;
    if (!portalHostRef.current) {
      const host = document.createElement('div');
      host.style.position = 'relative';
      host.style.pointerEvents = 'auto';
      portalHostRef.current = host;
      portalRoot.appendChild(host);
    }
    return () => {
      const host = portalHostRef.current;
      if (host && portalRoot.contains(host)) {
        portalRoot.removeChild(host);
      }
      portalHostRef.current = null;
    };
  }, [portalRoot]);

  const windowRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const suppressNotifyRef = useRef(false);
  const interactionNotifySuppressedRef = useRef(false);
  const interactionStateUpdatedRef = useRef(false);
  const pendingStateRef = useRef<WindowState | null>(null);
  const rafPendingRef = useRef<number | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ width: 0, height: 0, x: 0, y: 0, positionX: 0, positionY: 0 });
  const resizeDirection = useRef<string>('');
  const setInteractionActive = useCallback((active: boolean) => {
    if (typeof document === 'undefined') return;
    const body = document.body;
    if (!body) return;
    if (active) {
      body.dataset.hdbFloatingWindowInteraction = '1';
    } else {
      delete body.dataset.hdbFloatingWindowInteraction;
    }
  }, []);
  const releaseActivePointerCapture = useCallback(() => {
    if (activePointerIdRef.current === null) {
      return;
    }
    const node = windowRef.current;
    const pointerId = activePointerIdRef.current;
    if (node && node.hasPointerCapture(pointerId)) {
      node.releasePointerCapture(pointerId);
    }
    activePointerIdRef.current = null;
  }, []);
  const resetInteractionState = useCallback(() => {
    isDragging.current = false;
    isResizing.current = false;
    resizeDirection.current = '';
    if (rafPendingRef.current !== null) {
      cancelAnimationFrame(rafPendingRef.current);
      rafPendingRef.current = null;
    }
    pendingStateRef.current = null;
    interactionNotifySuppressedRef.current = false;
    interactionStateUpdatedRef.current = false;
    releaseActivePointerCapture();
    setIsInteracting(false);
    setInteractionActive(false);
    setOverlayActive(false);
  }, [releaseActivePointerCapture, setInteractionActive]);

  const [state, setState] = useState<WindowState>({
    position: initialState?.position || { x: 100, y: 100 },
    size: initialState?.size || { width: 400, height: 300 },
    isMinimized: initialState?.isMinimized || false,
    isFullscreen: initialState?.isFullscreen || false,
    isVisible: initialState?.isVisible !== false,
    zIndex: initialState?.zIndex || 1000,
  });
  const stateRef = useRef<WindowState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const isSameWindowState = useCallback((lhs: WindowState, rhs: WindowState): boolean => (
    lhs.position.x === rhs.position.x
    && lhs.position.y === rhs.position.y
    && lhs.size.width === rhs.size.width
    && lhs.size.height === rhs.size.height
    && lhs.isMinimized === rhs.isMinimized
    && lhs.isFullscreen === rhs.isFullscreen
    && lhs.isVisible === rhs.isVisible
    && lhs.zIndex === rhs.zIndex
  ), []);
  const applyWindowStyle = useCallback((next: WindowState) => {
    const node = windowRef.current;
    if (!node) {
      return;
    }
    node.style.left = `${next.position.x}px`;
    node.style.top = `${next.position.y}px`;
    node.style.width = `${next.isMinimized ? 250 : next.size.width}px`;
    node.style.height = `${next.isMinimized ? 40 : next.size.height}px`;
  }, []);
  const flushPendingInteractionState = useCallback(() => {
    if (rafPendingRef.current !== null) {
      cancelAnimationFrame(rafPendingRef.current);
      rafPendingRef.current = null;
    }
    const next = pendingStateRef.current;
    pendingStateRef.current = null;
    if (!next) {
      return;
    }
    stateRef.current = next;
    applyWindowStyle(next);
  }, [applyWindowStyle]);
  const scheduleInteractionState = useCallback((next: WindowState) => {
    pendingStateRef.current = next;
    interactionStateUpdatedRef.current = true;
    if (rafPendingRef.current !== null) {
      return;
    }
    rafPendingRef.current = requestAnimationFrame(() => {
      rafPendingRef.current = null;
      flushPendingInteractionState();
    });
  }, [flushPendingInteractionState]);
  const normalStateRef = useRef<{
    position: { x: number; y: number };
    size: { width: number; height: number };
  } | null>(null);
  const effectiveMaxWidth = maxWidth || window.innerWidth - 50;
  const effectiveMaxHeight = maxHeight || window.innerHeight - 50;
  const clamp = useCallback(
    (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)),
    []
  );
  const resolveBounds = useCallback(() => {
    const minVisibleLeft = 64;
    const minVisibleTop = 24;
    return {
      minX: 0,
      minY: 0,
      maxX: Math.max(0, window.innerWidth - minVisibleLeft),
      maxY: Math.max(0, window.innerHeight - minVisibleTop),
    };
  }, []);

  const resolveIncomingState = useCallback(
    (prev: WindowState, incoming?: Partial<WindowState>): WindowState | null => {
      if (!incoming) return null;
      const normalizePosition = (value: WindowState['position'] | undefined) => {
        if (!value) return prev.position;
        const { x, y } = value;
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          return prev.position;
        }
        const bounds = resolveBounds();
        return {
          x: clamp(x, bounds.minX, bounds.maxX),
          y: clamp(y, bounds.minY, bounds.maxY),
        };
      };
      const normalizeSize = (value: WindowState['size'] | undefined) => {
        if (!value) return prev.size;
        const { width, height } = value;
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
          return prev.size;
        }
        return value;
      };
      const normalizeZIndex = (value: number | undefined) => (
        typeof value === 'number' && Number.isFinite(value) ? value : prev.zIndex
      );
      const next: WindowState = {
        position: normalizePosition(incoming.position),
        size: normalizeSize(incoming.size),
        isMinimized: incoming.isMinimized ?? prev.isMinimized,
        isFullscreen: incoming.isFullscreen ?? prev.isFullscreen,
        isVisible: incoming.isVisible ?? prev.isVisible,
        zIndex: normalizeZIndex(incoming.zIndex),
      };
      const samePosition = next.position.x === prev.position.x && next.position.y === prev.position.y;
      const sameSize = next.size.width === prev.size.width && next.size.height === prev.size.height;
      const sameFlags = next.isMinimized === prev.isMinimized
        && next.isFullscreen === prev.isFullscreen
        && next.isVisible === prev.isVisible
        && next.zIndex === prev.zIndex;
      if (samePosition && sameSize && sameFlags) return null;
      return next;
    },
    [clamp, resolveBounds]
  );

  useEffect(() => {
    setState((prev: WindowState) => {
      const next = resolveIncomingState(prev, initialState);
      if (next) {
        suppressNotifyRef.current = true;
      }
      return next ?? prev;
    });
  }, [initialState, resolveIncomingState]);

  useEffect(() => {
    if (suppressNotifyRef.current) {
      suppressNotifyRef.current = false;
      return;
    }
    if (interactionNotifySuppressedRef.current) {
      return;
    }
    onStateChange?.(state);
  }, [state, onStateChange]);

  const bringToFront = useCallback(() => {
    const host = portalHostRef.current;
    const parent = host?.parentElement;
    if (host && parent && parent.lastElementChild !== host) {
      parent.appendChild(host);
    }
    onRequestFocus?.();
  }, [onRequestFocus]);

  const exitFullscreenForInteraction = useCallback((): WindowState => {
    const current = stateRef.current;
    if (!current.isFullscreen) {
      return current;
    }

    const restored = normalStateRef.current ?? { position: current.position, size: current.size };
    const bounds = resolveBounds();
    const next: WindowState = {
      ...current,
      isFullscreen: false,
      isMinimized: false,
      position: {
        x: clamp(restored.position.x, bounds.minX, bounds.maxX),
        y: clamp(restored.position.y, bounds.minY, bounds.maxY),
      },
      size: {
        width: Math.max(minWidth, Math.min(restored.size.width, effectiveMaxWidth)),
        height: Math.max(minHeight, Math.min(restored.size.height, effectiveMaxHeight)),
      },
    };

    stateRef.current = next;
    setState(next);
    return next;
  }, [clamp, effectiveMaxHeight, effectiveMaxWidth, minHeight, minWidth, resolveBounds]);

  const handleMouseDown = useCallback((event: React.PointerEvent) => {
    if (!draggable || event.button !== 0) return;

    const target = event.target as HTMLElement;
    if (!target.closest('.title-bar')) return;
    if (target.closest('button')) return;

    if (event.detail > 1) {
      return;
    }

    interactionNotifySuppressedRef.current = true;
    setIsInteracting(true);
    const interactionState = exitFullscreenForInteraction();
    isDragging.current = true;
    activePointerIdRef.current = event.pointerId;
    windowRef.current?.setPointerCapture(event.pointerId);
    setInteractionActive(true);
    setOverlayActive(true);
    bringToFront();
    dragStart.current = {
      x: event.clientX - interactionState.position.x,
      y: event.clientY - interactionState.position.y,
    };
    event.preventDefault();
  }, [bringToFront, draggable, exitFullscreenForInteraction, setInteractionActive, setIsInteracting]);

  const handleResizeMouseDown = useCallback((direction: string) => (event: React.PointerEvent) => {
    if (!resizable || event.button !== 0) return;
    if (stateRef.current.isMinimized) return;

    interactionNotifySuppressedRef.current = true;
    setIsInteracting(true);
    const interactionState = exitFullscreenForInteraction();
    isResizing.current = true;
    activePointerIdRef.current = event.pointerId;
    windowRef.current?.setPointerCapture(event.pointerId);
    setInteractionActive(true);
    setOverlayActive(true);
    bringToFront();
    resizeDirection.current = direction;
    resizeStart.current = {
      width: interactionState.size.width,
      height: interactionState.size.height,
      x: event.clientX,
      y: event.clientY,
      positionX: interactionState.position.x,
      positionY: interactionState.position.y,
    };

    event.preventDefault();
    event.stopPropagation();
  }, [bringToFront, exitFullscreenForInteraction, resizable, setInteractionActive, setIsInteracting]);

  const interactionEnabled = state.isVisible;
  useEffect(() => {
    const handleMouseMove = (event: PointerEvent) => {
      if (activePointerIdRef.current !== null && event.pointerId !== activePointerIdRef.current) {
        return;
      }
      if (isDragging.current) {
        const { minX, minY, maxX, maxY } = resolveBounds();
        const newX = clamp(event.clientX - dragStart.current.x, minX, maxX);
        const newY = clamp(event.clientY - dragStart.current.y, minY, maxY);
        const current = stateRef.current;
        const nextState: WindowState = {
          ...current,
          position: { x: newX, y: newY },
        };
        scheduleInteractionState(nextState);
      }

      if (isResizing.current) {
        const deltaX = event.clientX - resizeStart.current.x;
        const deltaY = event.clientY - resizeStart.current.y;
        const dir = resizeDirection.current;

        let newWidth = resizeStart.current.width;
        let newHeight = resizeStart.current.height;
        let newX = resizeStart.current.positionX;
        let newY = resizeStart.current.positionY;

        if (dir.includes('e')) {
          newWidth = Math.max(minWidth, Math.min(resizeStart.current.width + deltaX, effectiveMaxWidth));
        } else if (dir.includes('w')) {
          const clampedWidth = Math.max(minWidth, Math.min(resizeStart.current.width - deltaX, effectiveMaxWidth));
          newWidth = clampedWidth;
          newX = resizeStart.current.positionX + (resizeStart.current.width - clampedWidth);
        }

        if (dir.includes('s')) {
          newHeight = Math.max(minHeight, Math.min(resizeStart.current.height + deltaY, effectiveMaxHeight));
        } else if (dir.includes('n')) {
          const clampedHeight = Math.max(minHeight, Math.min(resizeStart.current.height - deltaY, effectiveMaxHeight));
          newHeight = clampedHeight;
          newY = resizeStart.current.positionY + (resizeStart.current.height - clampedHeight);
        }

        const bounds = resolveBounds();
        const clampedX = clamp(newX, bounds.minX, bounds.maxX);
        const clampedY = clamp(newY, bounds.minY, bounds.maxY);
        const current = stateRef.current;
        const nextState: WindowState = {
          ...current,
          position: { x: clampedX, y: clampedY },
          size: { width: newWidth, height: newHeight },
        };
        scheduleInteractionState(nextState);
      }
    };

    const handleMouseUp = () => {
      releaseActivePointerCapture();
      flushPendingInteractionState();
      const shouldNotify = interactionNotifySuppressedRef.current && interactionStateUpdatedRef.current;
      const latestState = stateRef.current;
      isDragging.current = false;
      isResizing.current = false;
      resizeDirection.current = '';
      interactionNotifySuppressedRef.current = false;
      interactionStateUpdatedRef.current = false;
      setIsInteracting(false);
      setInteractionActive(false);
      setOverlayActive(false);
      if (shouldNotify) {
        setState((prev: WindowState) => (isSameWindowState(prev, latestState) ? prev : latestState));
      }
    };

    if (interactionEnabled) {
      document.addEventListener('pointermove', handleMouseMove);
      document.addEventListener('pointerup', handleMouseUp);
      document.addEventListener('pointercancel', handleMouseUp);
    }

    return () => {
      document.removeEventListener('pointermove', handleMouseMove);
      document.removeEventListener('pointerup', handleMouseUp);
      document.removeEventListener('pointercancel', handleMouseUp);
      if (rafPendingRef.current !== null) {
        cancelAnimationFrame(rafPendingRef.current);
        rafPendingRef.current = null;
      }
    };
  }, [
    clamp,
    effectiveMaxHeight,
    effectiveMaxWidth,
    interactionEnabled,
    minHeight,
    minWidth,
    isSameWindowState,
    resolveBounds,
    flushPendingInteractionState,
    scheduleInteractionState,
    setInteractionActive,
    releaseActivePointerCapture,
  ]);

  const handleMinimize = useCallback(() => {
    resetInteractionState();
    bringToFront();
    setState((prev: WindowState) => {
      if (prev.isMinimized) {
        return { ...prev, isMinimized: false };
      }
      const normal = prev.isFullscreen ? normalStateRef.current : null;
      return {
        ...prev,
        isMinimized: true,
        isFullscreen: false,
        position: normal?.position ?? prev.position,
        size: normal?.size ?? prev.size,
      };
    });
  }, [bringToFront, resetInteractionState]);

  const handleFullscreen = useCallback(() => {
    resetInteractionState();
    bringToFront();
    setState((prev: WindowState) => {
      if (prev.isFullscreen) {
        const normal = normalStateRef.current;
        return {
          ...prev,
          isFullscreen: false,
          position: normal?.position ?? prev.position,
          size: normal?.size ?? prev.size,
        };
      }
      normalStateRef.current = { position: prev.position, size: prev.size };
      return {
        ...prev,
        isFullscreen: true,
        isMinimized: false,
        position: { x: 0, y: 0 },
        size: { width: Math.max(minWidth, window.innerWidth), height: Math.max(minHeight, window.innerHeight) },
      };
    });
  }, [bringToFront, minHeight, minWidth, resetInteractionState]);

  const handleClose = useCallback(() => {
    resetInteractionState();
    bringToFront();
    setState((prev: WindowState) => ({ ...prev, isVisible: false }));
    onClose?.();
  }, [bringToFront, onClose, resetInteractionState]);

  useEffect(() => {
    if (!state.isFullscreen) return;
    const handleResize = () => {
      setState((prev: WindowState) => {
        if (prev.isFullscreen) {
          return {
            ...prev,
            position: { x: 0, y: 0 },
            size: { width: Math.max(minWidth, window.innerWidth), height: Math.max(minHeight, window.innerHeight) },
          };
        }
        return prev;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [minHeight, minWidth, state.isFullscreen]);

  useEffect(() => {
    if (!state.isFullscreen && !state.isMinimized) return;
    resetInteractionState();
  }, [resetInteractionState, state.isFullscreen, state.isMinimized]);

  const effectiveWindowState = isInteracting ? stateRef.current : state;
  const windowStyle = {
    left: effectiveWindowState.position.x,
    top: effectiveWindowState.position.y,
    width: effectiveWindowState.isMinimized ? 250 : effectiveWindowState.size.width,
    height: effectiveWindowState.isMinimized ? 40 : effectiveWindowState.size.height,
    zIndex: 0,
    display: state.isVisible ? 'flex' : 'none',
    ...style,
  };

  const handleWindowMouseDownCapture = useCallback((event: React.PointerEvent) => {
    if (event.button !== 0) return;
    bringToFront();
  }, [bringToFront]);

  const handleTitleBarMouseDownCapture = useCallback((event: React.PointerEvent) => {
    if (event.button !== 0) return;
    bringToFront();
  }, [bringToFront]);

  const handleTitleBarDoubleClick = useCallback(() => {
    if (!draggable || state.isMinimized) return;
    handleFullscreen();
  }, [draggable, handleFullscreen, state.isMinimized]);

  return {
    portalRoot,
    portalHostRef,
    windowRef,
    state,
    overlayActive,
    overlayCursor: isResizing.current ? 'nwse-resize' : 'move',
    windowStyle,
    bringToFront,
    handleMouseDown,
    handleResizeMouseDown,
    handleMinimize,
    handleFullscreen,
    handleClose,
    handleWindowMouseDownCapture,
    handleTitleBarMouseDownCapture,
    handleTitleBarDoubleClick,
    isProviderPortal: portalContext.isProvider,
  };
}
