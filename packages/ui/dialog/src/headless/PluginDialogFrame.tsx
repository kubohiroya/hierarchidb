import type React from 'react';
import { Box, Fade } from '@mui/material';
import { createPortal } from 'react-dom';
import { HeadlessPluginDialog } from './PluginDialog.js';
import type { PluginDialogFrameComponentProps } from './PluginDialogFrame.types.js';
import { usePluginDialogFrame } from './usePluginDialogFrame.js';

export function PluginDialogFrame<TData>(props: PluginDialogFrameComponentProps<TData>) {
  const state = usePluginDialogFrame(props);
  const { open } = state.augmentedHeadlessProps;

  const frameNode = (
    <Box
      sx={state.combinedFrameSx}
      role="dialog"
      aria-modal="true"
      onKeyDown={state.handleKeyDown}
      onContextMenu={state.handleContextMenu}
      onPointerDown={state.handleFramePointerDown}
    >
      <HeadlessPluginDialog {...state.augmentedHeadlessProps} />
      {state.allowResizeHandles && (
        state.resizeHandles.map((handle) => (
          <Box
            key={handle.key}
            sx={(theme) => ({
              position: 'absolute',
              zIndex: (theme.zIndex?.modal ?? 1300) + 5,
              ...handle.sx,
            })}
            onPointerDown={(event) => {
              state.handleResizePointerDown(handle.direction, event);
              state.augmentedHeadlessProps.onResizeHandlePointerDown?.(event);
            }}
          />
        ))
      )}
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
        sx={state.combinedBackdropSx}
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
