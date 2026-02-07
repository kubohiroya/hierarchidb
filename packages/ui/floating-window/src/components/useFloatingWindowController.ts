/**
 * @file useFloatingWindowController.ts
 * @description Logic hook for FloatingWindow interactions and state.
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FloatingWindowProps, WindowState } from '../types/WindowState.js';
import {
  DEFAULT_FLOATING_WINDOW_Z_INDEX,
  FLOATING_WINDOW_ROOT_ID,
  useFloatingWindowPortal,
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
  windowRef: React.RefObject<HTMLDivElement>;
  state: WindowState;
  overlayActive: boolean;
  overlayCursor: string;
  windowStyle: React.CSSProperties;
  bringToFront: () => void;
  handleMouseDown: (event: React.MouseEvent) => void;
  handleResizeMouseDown: (direction: string) => (event: React.MouseEvent) => void;
  handleMinimize: () => void;
  handleFullscreen: () => void;
  handleClose: () => void;
  handleWindowMouseDownCapture: (event: React.MouseEvent) => void;
  handleTitleBarMouseDownCapture: (event: React.MouseEvent) => void;
  handleTitleBarDoubleClick: () => void;
  isProviderPortal: boolean;
};

export function useFloatingWindowController(
  props: FloatingWindowProps
): FloatingWindowController {
  const {
    initialState,
    onStateChange,
    onClose,
    minWidth = 200,
    minHeight = 100,
    maxWidth,
    maxHeight,
    resizable = true,
    draggable = true,
    style,
  } = props;

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
  const [overlayActive, setOverlayActive] = useState(false);
  const resetInteractionState = useCallback(() => {
    isDragging.current = false;
    isResizing.current = false;
    resizeDirection.current = '';
    setInteractionActive(false);
    setOverlayActive(false);
  }, [setInteractionActive]);

  const portalContext = useFloatingWindowPortal();
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
  const dragStart = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ width: 0, height: 0, x: 0, y: 0, positionX: 0, positionY: 0 });
  const resizeDirection = useRef<string>('');

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
    setState((prev) => {
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
    onStateChange?.(state);
  }, [state, onStateChange]);

  const bringToFront = useCallback(() => {
    const host = portalHostRef.current;
    const parent = host?.parentElement;
    if (host && parent && parent.lastElementChild !== host) {
      parent.appendChild(host);
    }
  }, []);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (!draggable || event.button !== 0) return;
    if (state.isFullscreen) return;

    const target = event.target as HTMLElement;
    if (!target.closest('.title-bar')) return;
    if (target.closest('button')) return;

    if (event.detail > 1) {
      return;
    }

    isDragging.current = true;
    setInteractionActive(true);
    setOverlayActive(true);
    bringToFront();
    dragStart.current = {
      x: event.clientX - stateRef.current.position.x,
      y: event.clientY - stateRef.current.position.y,
    };
    event.preventDefault();
  }, [bringToFront, draggable, setInteractionActive, state.isFullscreen]);

  const handleResizeMouseDown = useCallback((direction: string) => (event: React.MouseEvent) => {
    if (!resizable || event.button !== 0) return;
    if (state.isMinimized || state.isFullscreen) return;

    isResizing.current = true;
    setInteractionActive(true);
    setOverlayActive(true);
    bringToFront();
    resizeDirection.current = direction;
    resizeStart.current = {
      width: stateRef.current.size.width,
      height: stateRef.current.size.height,
      x: event.clientX,
      y: event.clientY,
      positionX: stateRef.current.position.x,
      positionY: stateRef.current.position.y,
    };

    event.preventDefault();
    event.stopPropagation();
  }, [bringToFront, resizable, setInteractionActive, state.isFullscreen, state.isMinimized]);

  const interactionEnabled = state.isVisible;
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (isDragging.current) {
        const { minX, minY, maxX, maxY } = resolveBounds();
        const newX = clamp(event.clientX - dragStart.current.x, minX, maxX);
        const newY = clamp(event.clientY - dragStart.current.y, minY, maxY);

        setState((prev) => ({
          ...prev,
          position: { x: newX, y: newY },
        }));
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
        setState((prev) => ({
          ...prev,
          position: { x: clampedX, y: clampedY },
          size: { width: newWidth, height: newHeight },
        }));
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      isResizing.current = false;
      resizeDirection.current = '';
      setInteractionActive(false);
      setOverlayActive(false);
    };

    if (interactionEnabled) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    clamp,
    effectiveMaxHeight,
    effectiveMaxWidth,
    interactionEnabled,
    minHeight,
    minWidth,
    resolveBounds,
    setInteractionActive,
  ]);

  const handleMinimize = useCallback(() => {
    resetInteractionState();
    bringToFront();
    setState((prev) => {
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
    setState((prev) => {
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
    setState((prev) => ({ ...prev, isVisible: false }));
    onClose?.();
  }, [bringToFront, onClose, resetInteractionState]);

  useEffect(() => {
    if (!state.isFullscreen) return;
    const handleResize = () => {
      setState((prev) => {
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

  const windowStyle = useMemo(() => ({
    left: state.position.x,
    top: state.position.y,
    width: state.isMinimized ? 250 : state.size.width,
    height: state.isMinimized ? 40 : state.size.height,
    zIndex: 0,
    display: state.isVisible ? 'flex' : 'none',
    ...style,
  }), [state, style]);

  const handleWindowMouseDownCapture = useCallback((event: React.MouseEvent) => {
    if (event.button !== 0) return;
    bringToFront();
  }, [bringToFront]);

  const handleTitleBarMouseDownCapture = useCallback((event: React.MouseEvent) => {
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
