/**
 * @file FloatingWindow.tsx
 * @description Main floating window component with drag and resize functionality
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, IconButton, Paper, styled, Typography } from '@mui/material';
import { Close as CloseIcon, CropSquare as RestoreIcon, Minimize as MinimizeIcon } from '@mui/icons-material';
import type { FloatingWindowProps, WindowState } from '../types/WindowState.js';

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
  padding: theme.spacing(1, 2),
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  cursor: 'move',
  minHeight: 40,
}));

const WindowContent = styled(Box)(({ theme }) => ({
  flex: 1,
  padding: theme.spacing(2),
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
  const dragStart = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ width: 0, height: 0, x: 0, y: 0 });
  const resizeDirection = useRef<string>('');

  const [state, setState] = useState<WindowState>({
    position: initialState?.position || { x: 100, y: 100 },
    size: initialState?.size || { width: 400, height: 300 },
    isMinimized: initialState?.isMinimized || false,
    isVisible: initialState?.isVisible !== false,
    zIndex: initialState?.zIndex || 1000,
  });

  // Calculate constraints
  const effectiveMaxWidth = maxWidth || window.innerWidth - 50;
  const effectiveMaxHeight = maxHeight || window.innerHeight - 50;

  // Update external state
  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  // Handle dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!draggable || e.button !== 0) return;

    // Check if clicking on title bar
    const target = e.target as HTMLElement;
    if (!target.closest('.title-bar')) return;

    isDragging.current = true;
    dragStart.current = {
      x: e.clientX - state.position.x,
      y: e.clientY - state.position.y,
    };

    e.preventDefault();
  }, [draggable, state.position]);

  // Handle resizing
  const handleResizeMouseDown = useCallback((direction: string) => (e: React.MouseEvent) => {
    if (!resizable || e.button !== 0) return;

    isResizing.current = true;
    resizeDirection.current = direction;
    resizeStart.current = {
      width: state.size.width,
      height: state.size.height,
      x: e.clientX,
      y: e.clientY,
    };

    e.preventDefault();
    e.stopPropagation();
  }, [resizable, state.size]);

  // Global mouse move handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        const newX = Math.max(0, Math.min(e.clientX - dragStart.current.x, window.innerWidth - state.size.width));
        const newY = Math.max(0, Math.min(e.clientY - dragStart.current.y, window.innerHeight - 40));

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
        let newX = state.position.x;
        let newY = state.position.y;

        // Handle horizontal resizing
        if (dir.includes('e')) {
          newWidth = Math.max(minWidth, Math.min(resizeStart.current.width + deltaX, effectiveMaxWidth));
        } else if (dir.includes('w')) {
          const potentialWidth = resizeStart.current.width - deltaX;
          if (potentialWidth >= minWidth && potentialWidth <= effectiveMaxWidth) {
            newWidth = potentialWidth;
            newX = state.position.x + deltaX;
          }
        }

        // Handle vertical resizing
        if (dir.includes('s')) {
          newHeight = Math.max(minHeight, Math.min(resizeStart.current.height + deltaY, effectiveMaxHeight));
        } else if (dir.includes('n')) {
          const potentialHeight = resizeStart.current.height - deltaY;
          if (potentialHeight >= minHeight && potentialHeight <= effectiveMaxHeight) {
            newHeight = potentialHeight;
            newY = state.position.y + deltaY;
          }
        }

        setState(prev => ({
          ...prev,
          position: { x: newX, y: newY },
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
  }, [state, minWidth, minHeight, effectiveMaxWidth, effectiveMaxHeight]);

  // Handle minimize/restore
  const handleMinimize = useCallback(() => {
    setState(prev => ({ ...prev, isMinimized: !prev.isMinimized }));
  }, []);

  // Handle close
  const handleClose = useCallback(() => {
    setState(prev => ({ ...prev, isVisible: false }));
    onClose?.();
  }, [onClose]);

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
    >
      <TitleBar
        className="title-bar"
        onMouseDown={handleMouseDown}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
          {title}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={handleMinimize}
            sx={{ color: 'inherit', padding: 0.5 }}
          >
            {state.isMinimized ? <RestoreIcon fontSize="small" /> : <MinimizeIcon fontSize="small" />}
          </IconButton>
          <IconButton
            size="small"
            onClick={handleClose}
            sx={{ color: 'inherit', padding: 0.5 }}
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