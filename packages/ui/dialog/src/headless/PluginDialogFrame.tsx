import { Box, Fade } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { createPortal } from 'react-dom';
import { AbstractDialog } from './AbstractDialog.js';
import type { PluginDialogFrameComponentProps } from './PluginDialogFrame.types.js';
import { usePluginDialogFrame } from './usePluginDialogFrame.js';

export function PluginDialogFrame<TData>(props: PluginDialogFrameComponentProps<TData>) {
  const state = usePluginDialogFrame(props);
  const { open } = state.augmentedHeadlessProps;

  const frameNode = (
    <Box
      sx={state.combinedFrameSx as SxProps<Theme>}
      role="dialog"
      aria-modal="true"
      onKeyDown={state.handleKeyDown}
      onContextMenu={state.handleContextMenu}
      onPointerDown={state.handleFramePointerDown}
    >
      <AbstractDialog {...state.augmentedHeadlessProps} />
      {state.allowResizeHandles &&
        state.resizeHandles.map((handle) => (
          <Box
            key={handle.key}
            sx={(theme) => {
              const handleSx = typeof handle.sx === 'function' ? handle.sx(theme) : handle.sx;
              return {
                position: 'absolute',
                zIndex: (theme.zIndex?.modal ?? 1300) + 5,
                ...handleSx,
              };
            }}
            onPointerDown={(event) => {
              state.handleResizePointerDown(handle.direction, event);
              state.augmentedHeadlessProps.onResizeHandlePointerDown?.(event);
            }}
          />
        ))}
    </Box>
  );

  const dialogNode = (
    <Fade
      in={open}
      timeout={state.backdropTimeout}
      appear={state.shouldAnimateBackdrop}
      mountOnEnter
      unmountOnExit
    >
      <Box
        sx={state.combinedBackdropSx as SxProps<Theme>}
        role="presentation"
        onPointerDown={state.handleBackdropPointerDown}
        onWheel={state.handleWheelCapture}
      >
        {frameNode}
      </Box>
    </Fade>
  );

  if (!state.isBrowser || !state.portalTarget) {
    return dialogNode;
  }

  return createPortal(dialogNode, state.portalTarget);
}
