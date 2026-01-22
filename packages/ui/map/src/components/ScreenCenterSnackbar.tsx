/**
 * @file ScreenCenterSnackbar.tsx
 * @description Lightweight center-screen overlay for transient status messages.
 */

import type React from 'react';
import { useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

export type ScreenCenterSnackbarProps = {
  open: boolean;
  message?: React.ReactNode;
  autoHideDuration?: number | null;
  onClose?: () => void;
  enterDuration?: number;
  exitDuration?: number;
  containerSx?: SxProps<Theme>;
  textSx?: SxProps<Theme>;
};

const DEFAULT_AUTO_HIDE_MS = 800;
const DEFAULT_ENTER_MS = 140;
const DEFAULT_EXIT_MS = 180;

export const ScreenCenterSnackbar: React.FC<ScreenCenterSnackbarProps> = ({
  open,
  message,
  autoHideDuration = DEFAULT_AUTO_HIDE_MS,
  onClose,
  enterDuration = DEFAULT_ENTER_MS,
  exitDuration = DEFAULT_EXIT_MS,
  containerSx,
  textSx,
}) => {
  useEffect(() => {
    if (!open || autoHideDuration == null || !onClose) return undefined;
    const timer = globalThis.setTimeout(() => onClose(), autoHideDuration);
    return () => globalThis.clearTimeout(timer);
  }, [open, autoHideDuration, onClose, message]);

  if (!open && !message) return null;

  const durationMs = open ? enterDuration : exitDuration;

  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 3,
        ...containerSx,
      }}
    >
      <Typography
        component="div"
        sx={{
          px: 2,
          py: 0.5,
          color: 'common.white',
          fontSize: 'clamp(18px, 3vw, 30px)',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          textShadow: '0 6px 18px rgba(0, 0, 0, 0.35)',
          opacity: open ? 0.88 : 0,
          transform: open ? 'scale(1)' : 'scale(0.96)',
          transition: `opacity ${durationMs}ms ease, transform ${durationMs}ms ease`,
          userSelect: 'none',
          ...textSx,
        }}
      >
        {message}
      </Typography>
    </Box>
  );
};
