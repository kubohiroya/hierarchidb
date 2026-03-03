import { useEffect } from 'react';
import type { ScreenCenterSnackbarProps } from './ScreenCenterSnackbar.js';

type UseScreenCenterSnackbarParams = Pick<
  ScreenCenterSnackbarProps,
  'open' | 'autoHideDuration' | 'onClose' | 'enterDuration' | 'exitDuration' | 'message'
>;

export const useScreenCenterSnackbar = ({
  open,
  autoHideDuration,
  onClose,
  enterDuration,
  exitDuration,
  message,
}: UseScreenCenterSnackbarParams) => {
  useEffect(() => {
    if (!open || autoHideDuration == null || !onClose) return undefined;
    const timer = globalThis.setTimeout(() => onClose(), autoHideDuration);
    return () => globalThis.clearTimeout(timer);
  }, [open, autoHideDuration, onClose, message]);

  return {
    shouldRender: open || Boolean(message),
    durationMs: open ? enterDuration : exitDuration,
  };
};
