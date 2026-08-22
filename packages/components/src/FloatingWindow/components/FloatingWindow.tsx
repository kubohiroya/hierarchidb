/**
 * @file FloatingWindow.tsx
 * @description Main floating window component with drag and resize functionality
 */

import {
  Close as CloseIcon,
  FullscreenExit as FullscreenExitIcon,
  Fullscreen as FullscreenIcon,
  Minimize as MinimizeIcon,
  FilterNone as RestoreIcon,
  Window as WindowIcon,
} from '@mui/icons-material';
import { Box, IconButton, Paper, styled, Typography } from '@mui/material';
import type React from 'react';
import { createPortal } from 'react-dom';
import type { FloatingWindowProps } from '../types/WindowState.js';
import { useFloatingWindowController } from './useFloatingWindowController.js';

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
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
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

export const FloatingWindow: React.FC<FloatingWindowProps> = (props) => {
  const { title, titleIcon, children, resizable = true, className } = props;
  const controller = useFloatingWindowController(props);
  const overlayZIndex = 1;

  if (!controller.state.isVisible) {
    return null;
  }
  if (controller.isProviderPortal && !controller.portalRoot) {
    return null;
  }

  const overlayNode = (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'transparent',
        zIndex: overlayZIndex,
        cursor: controller.overlayCursor,
        pointerEvents: 'auto',
      }}
    />
  );
  const windowNode = (
    <StyledWindow
      ref={controller.windowRef}
      className={`floating-window ${className || ''}`}
      style={{ ...controller.windowStyle, pointerEvents: 'auto' }}
      elevation={8}
      onPointerDownCapture={controller.handleWindowMouseDownCapture}
    >
      <TitleBar
        className="title-bar"
        onPointerDown={controller.handleMouseDown}
        onDoubleClick={controller.handleTitleBarDoubleClick}
        onPointerDownCapture={controller.handleTitleBarMouseDownCapture}
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
            onClick={controller.handleMinimize}
            sx={{ color: 'inherit', padding: '2px' }}
          >
            {controller.state.isMinimized ? (
              <RestoreIcon fontSize="small" />
            ) : (
              <MinimizeIcon fontSize="small" />
            )}
          </IconButton>
          <IconButton
            size="small"
            onClick={controller.handleFullscreen}
            sx={{ color: 'inherit', padding: '2px' }}
          >
            {controller.state.isFullscreen ? (
              <FullscreenExitIcon fontSize="small" />
            ) : (
              <FullscreenIcon fontSize="small" />
            )}
          </IconButton>
          <IconButton
            size="small"
            onClick={controller.handleClose}
            sx={{ color: 'inherit', padding: '2px' }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </TitleBar>

      {!controller.state.isMinimized && (
        <>
          <WindowContent>{children}</WindowContent>

          {resizable && (
            <>
              <ResizeHandle
                className="resize-n"
                onPointerDown={controller.handleResizeMouseDown('n')}
              />
              <ResizeHandle
                className="resize-ne"
                onPointerDown={controller.handleResizeMouseDown('ne')}
              />
              <ResizeHandle
                className="resize-e"
                onPointerDown={controller.handleResizeMouseDown('e')}
              />
              <ResizeHandle
                className="resize-se"
                onPointerDown={controller.handleResizeMouseDown('se')}
              />
              <ResizeHandle
                className="resize-s"
                onPointerDown={controller.handleResizeMouseDown('s')}
              />
              <ResizeHandle
                className="resize-sw"
                onPointerDown={controller.handleResizeMouseDown('sw')}
              />
              <ResizeHandle
                className="resize-w"
                onPointerDown={controller.handleResizeMouseDown('w')}
              />
              <ResizeHandle
                className="resize-nw"
                onPointerDown={controller.handleResizeMouseDown('nw')}
              />
            </>
          )}
        </>
      )}
    </StyledWindow>
  );

  return (
    <>
      {controller.overlayActive && controller.portalRoot
        ? createPortal(overlayNode, controller.portalRoot)
        : controller.overlayActive
          ? overlayNode
          : null}
      {controller.portalHostRef.current
        ? createPortal(windowNode, controller.portalHostRef.current)
        : windowNode}
    </>
  );
};
