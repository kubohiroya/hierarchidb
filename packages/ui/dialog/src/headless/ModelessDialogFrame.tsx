/**
 * @file ModelessDialogFrame.tsx
 * @description Modeless dialog frame with drag/resize support and z-order control.
 */

import { Box, Fade } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { createPortal } from 'react-dom';
import { AbstractDialog } from './AbstractDialog.js';
import type { HeadlessDialogProps } from './types.js';
import { type ResizeDirection, useModelessDialogFrameLogic } from './useModelessDialogFrameLogic.js';

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

const EDGE_HANDLE_THICKNESS = 12;
const EDGE_HANDLE_OFFSET = EDGE_HANDLE_THICKNESS / 2;
const CORNER_HANDLE_SIZE = 12;
const CORNER_HANDLE_OFFSET = CORNER_HANDLE_SIZE / 2;

const RESIZE_HANDLES: Array<{
  key: string;
  direction: ResizeDirection;
  sx: Record<string, number | string>;
}> = [
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
];

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

  const {
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
  } = useModelessDialogFrameLogic({
    headlessProps,
    frameSx,
    backdropIgnoreDelayMs,
    stopWheelPropagation,
    transitionDuration,
    frameless,
    transparent,
    onRequestFocus,
    minimizedHeight,
  });

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
          {RESIZE_HANDLES.map((handle) => (
            <Box
              key={handle.key}
              sx={(activeTheme) => ({
                position: 'absolute',
                zIndex: (activeTheme.zIndex?.modal ?? 1300) + (handle.key.includes('-') ? 6 : 5),
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
        sx={(activeTheme) => ({
          position: containerPosition,
          inset: 0,
          zIndex: zIndex ?? (activeTheme.zIndex?.modal ?? 1300) - 100,
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
