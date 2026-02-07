import type { Theme } from '@mui/material';
import { useMemo } from 'react';
import type { PluginDialogShellProps } from './PluginDialogShell.types.js';
import { usePluginDialogController } from './usePluginDialogController.js';

type PluginDialogShellState = ReturnType<typeof usePluginDialogController> & {
  backdropDismissEnabled?: boolean;
  backdropSx: { pointerEvents: 'none' } | undefined;
  unsavedDialogSlotProps: {
    root: { sx: { zIndex: (theme: Theme) => number } };
    backdrop: { sx: { zIndex: (theme: Theme) => number } };
    paper: { sx: { zIndex: (theme: Theme) => number } };
  };
};

export function usePluginDialogShell(props: PluginDialogShellProps): PluginDialogShellState {
  const { backdropDismissEnabled, ...controllerOptions } = props;
  const controller = usePluginDialogController(controllerOptions);
  const { unsavedChangeDialog } = controller;

  const backdropSx = unsavedChangeDialog?.open ? { pointerEvents: 'none' as const } : undefined;
  const unsavedDialogSlotProps = useMemo(() => ({
    root: {
      sx: {
        zIndex: (theme: Theme) => (theme?.zIndex?.modal ?? 1300) + 8000,
      },
    },
    backdrop: {
      sx: {
        zIndex: (theme: Theme) => (theme?.zIndex?.modal ?? 1300) + 8000,
      },
    },
    paper: {
      sx: {
        zIndex: (theme: Theme) => (theme?.zIndex?.modal ?? 1300) + 8001,
      },
    },
  }) as const, []);

  return {
    ...controller,
    backdropSx,
    unsavedDialogSlotProps,
    backdropDismissEnabled,
  };
}
