/**
 * @file FloatingWindow.tsx
 * @description Main floating window component with drag and resize functionality
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, IconButton, Paper, styled, Typography } from '@mui/material';
import {
  Close as CloseIcon,
  FilterNone as RestoreIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  Minimize as MinimizeIcon,
  Window as WindowIcon,
} from '@mui/icons-material';
import type { FloatingWindowProps, WindowState } from '../types/WindowState.js';

let floatingWindowZIndex = 2000;

const StyledWindow = styled(Paper)(({ theme }) => ({
  position: 'fixed',
  borderRadius: theme.spacing(1),
  boxShadow: theme.shadows[8],
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  userSelect: 'none',
  '&.floating-window': {
    transition: 'box-shadow 0.3s ease',
  },
  '&:hover': {
    boxShadow: theme.shadows[12],
  },
}));

const TitleBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 2,
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  cursor: 'move',
  minHeight: 24,
}));

const WindowContent = styled(Box)(({ theme }) => ({
  flex: 1,
  padding: 2,
  overflowY: 'auto',
  backgroundColor: theme.palette.background.paper,
}));

const ResizeHandle = styled(Box)({
  position: 'absolute',
  '&.resize-n': {
    top: 0,
    left: 10,
    right: 10,
    height: 5,
    cursor: 'ns-resize',
  },
  '&.resize-ne': {
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    cursor: 'nesw-resize',
  },
  '&.resize-e': {
    top: 10,
    right: 0,
    bottom: 10,
    width: 5,
    cursor: 'ew-resize',
  },
  '&.resize-se': {
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    cursor: 'nwse-resize',
  },
  '&.resize-s': {
    bottom: 0,
    left: 10,
    right: 10,
    height: 5,
    cursor: 'ns-resize',
  },
  '&.resize-sw': {
    bottom: 0,
    left: 0,
    width: 10,
    height: 10,
    cursor: 'nesw-resize',
  },
  '&.resize-w': {
    top: 10,
    left: 0,
    bottom: 10,
    width: 5,
    cursor: 'ew-resize',
  },
  '&.resize-nw': {
    top: 0,
    left: 0,
    width: 10,
    height: 10,
    cursor: 'nwse-resize',
  },
});

export const FloatingWindow: React.FC<FloatingWindowProps> = ({
  title,
  titleIcon,
  children,
  initialState,
  onStateChange,
  onClose,
  minWidth = 200,
  minHeight = 100,
  maxWidth,
  maxHeight,
  resizable = true,
  draggable = true,
  className,
  style,
}) => {

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
  const normalStateRef = useRef<{ position: { x: number; y: number }; size: { width: number; height: number } } | null>(null);
  const resolveIncomingState = useCallback((prev: WindowState, incoming?: Partial<WindowState>): WindowState | null => {
    if (!incoming) return null;
    const normalizePosition = (value: WindowState['position'] | undefined) => {
      if (!value) return prev.position;
      const { x, y } = value;
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return prev.position;
      }
      return value;
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
  }, []);

  useEffect(() => {
    setState((prev) => {
      const next = resolveIncomingState(prev, initialState);
      if (next) {
        suppressNotifyRef.current = true;
      }
      return next ?? prev;
    });
  }, [initialState, resolveIncomingState]);

  // Calculate constraints
  const effectiveMaxWidth = maxWidth || window.innerWidth - 50;
  const effectiveMaxHeight = maxHeight || window.innerHeight - 50;
  const clamp = useCallback((value: number, min: number, max: number) => Math.min(max, Math.max(min, value)), []);
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

  // Update external atoms
  useEffect(() => {
    if (suppressNotifyRef.current) {
      suppressNotifyRef.current = false;
      return;
    }
    onStateChange?.(state);
  }, [state, onStateChange]);

  // Handle dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!draggable || e.button !== 0) return;
    if (state.isFullscreen) return;

    // Check if clicking on title bar
    const target = e.target as HTMLElement;
    if (!target.closest('.title-bar')) return;

    isDragging.current = true;
    dragStart.current = {
      x: e.clientX - state.position.x,
      y: e.clientY - state.position.y,
    };
    e.preventDefault();
  }, [draggable, state.isFullscreen, state.position]);

  const bringToFront = useCallback(() => {
    floatingWindowZIndex += 1;
    setState(prev => {
      const nextZIndex = Math.max(prev.zIndex ?? 1000, floatingWindowZIndex);
      if (nextZIndex === prev.zIndex) return prev;
      return { ...prev, zIndex: nextZIndex };
    });
  }, []);

  // Handle resizing
  const handleResizeMouseDown = useCallback((direction: string) => (e: React.MouseEvent) => {
    if (!resizable || e.button !== 0) return;
    if (state.isMinimized || state.isFullscreen) return;

    isResizing.current = true;
    resizeDirection.current = direction;
    resizeStart.current = {
      width: state.size.width,
      height: state.size.height,
      x: e.clientX,
      y: e.clientY,
      positionX: state.position.x,
      positionY: state.position.y,
    };

    e.preventDefault();
    e.stopPropagation();
  }, [resizable, state.isFullscreen, state.isMinimized, state.position, state.size]);

  // Global mouse move handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        const { minX, minY, maxX, maxY } = resolveBounds();
        const newX = clamp(e.clientX - dragStart.current.x, minX, maxX);
        const newY = clamp(e.clientY - dragStart.current.y, minY, maxY);

        setState(prev => ({
          ...prev,
          position: { x: newX, y: newY },
        }));
      }

      if (isResizing.current) {
        const deltaX = e.clientX - resizeStart.current.x;
        const deltaY = e.clientY - resizeStart.current.y;
        const dir = resizeDirection.current;

        let newWidth = resizeStart.current.width;
        let newHeight = resizeStart.current.height;
        let newX = resizeStart.current.positionX;
        let newY = resizeStart.current.positionY;

        // Handle horizontal resizing
        if (dir.includes('e')) {
          newWidth = Math.max(minWidth, Math.min(resizeStart.current.width + deltaX, effectiveMaxWidth));
        } else if (dir.includes('w')) {
          const clampedWidth = Math.max(minWidth, Math.min(resizeStart.current.width - deltaX, effectiveMaxWidth));
          newWidth = clampedWidth;
          newX = resizeStart.current.positionX + (resizeStart.current.width - clampedWidth);
        }

        // Handle vertical resizing
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
        setState(prev => ({
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
    };

    if (state.isVisible && !state.isMinimized) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [clamp, effectiveMaxHeight, effectiveMaxWidth, minHeight, minWidth, resolveBounds, state]);

  // Handle minimize/restore
  const handleMinimize = useCallback(() => {
    setState(prev => {
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
  }, []);

  const handleFullscreen = useCallback(() => {
    setState(prev => {
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
  }, [minHeight, minWidth]);

  // Handle close
  const handleClose = useCallback(() => {
    setState(prev => ({ ...prev, isVisible: false }));
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!state.isFullscreen) return;
    const handleResize = () => {
      setState(prev => {
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

  // Calculate window styles
  const windowStyle = useMemo(() => ({
    left: state.position.x,
    top: state.position.y,
    width: state.isMinimized ? 250 : state.size.width,
    height: state.isMinimized ? 40 : state.size.height,
    zIndex: state.zIndex,
    display: state.isVisible ? 'flex' : 'none',
    ...style,
  }), [state, style]);

  if (!state.isVisible) {
    return null;
  }

  return (
    <StyledWindow
      ref={windowRef}
      className={`floating-window ${className || ''}`}
      style={windowStyle}
      elevation={8}
      onMouseDownCapture={(event) => {
        if (event.button !== 0) return;
        bringToFront();
      }}
    >
      <TitleBar
        className="title-bar"
        onMouseDown={handleMouseDown}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.83rem' }}>
          {titleIcon ?? <WindowIcon sx={{ fontSize: '1rem', ml: 1 }} />}
          <Typography sx={{ fontWeight: 600, fontSize: '0.83rem', lineHeight: 1.2 }}>
            {title}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={handleMinimize}
            sx={{ color: 'inherit', padding: '2px' }}
          >
            {state.isMinimized ? <RestoreIcon fontSize="small" /> : <MinimizeIcon fontSize="small" />}
          </IconButton>
          <IconButton
            size="small"
            onClick={handleFullscreen}
            sx={{ color: 'inherit', padding: '2px' }}
          >
            {state.isFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
          </IconButton>
          <IconButton
            size="small"
            onClick={handleClose}
            sx={{ color: 'inherit', padding: '2px' }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </TitleBar>

      {!state.isMinimized && (
        <>
          <WindowContent>
            {children}
          </WindowContent>

          {resizable && (
            <>
              <ResizeHandle className="resize-n" onMouseDown={handleResizeMouseDown('n')} />
              <ResizeHandle className="resize-ne" onMouseDown={handleResizeMouseDown('ne')} />
              <ResizeHandle className="resize-e" onMouseDown={handleResizeMouseDown('e')} />
              <ResizeHandle className="resize-se" onMouseDown={handleResizeMouseDown('se')} />
              <ResizeHandle className="resize-s" onMouseDown={handleResizeMouseDown('s')} />
              <ResizeHandle className="resize-sw" onMouseDown={handleResizeMouseDown('sw')} />
              <ResizeHandle className="resize-w" onMouseDown={handleResizeMouseDown('w')} />
              <ResizeHandle className="resize-nw" onMouseDown={handleResizeMouseDown('nw')} />
            </>
          )}
        </>
      )}
    </StyledWindow>
  );
};
