import { PluginDialogFrame, UnsavedChangesDialog } from '@hierarchidb/ui-dialog';
import type { Theme } from '@mui/material';
import type React from 'react';
import type { PluginDialogControllerOptions } from './usePluginDialogController.js';
import { usePluginDialogController } from './usePluginDialogController.js';

export interface PluginDialogShellProps extends PluginDialogControllerOptions {
  backdropDismissEnabled?: boolean;
}

export const PluginDialogShell: React.FC<PluginDialogShellProps> = (props) => {
  const { backdropDismissEnabled, ...controllerOptions } = props;
  const { headlessProps, unsavedChangeDialog, conflictDialog } =
    usePluginDialogController(controllerOptions);

  const backdropSx = unsavedChangeDialog?.open ? { pointerEvents: 'none' as const } : undefined;

  const unsavedDialogSlotProps = {
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
  } as const;
  return (
    <>
      <PluginDialogFrame
        headlessProps={headlessProps}
        backdropSx={backdropSx}
        backdropDismissEnabled={backdropDismissEnabled}
      />
      {conflictDialog}
      {unsavedChangeDialog ? (
        <UnsavedChangesDialog
          open={unsavedChangeDialog.open}
          title={unsavedChangeDialog.title}
          message={unsavedChangeDialog.message}
          onDiscard={unsavedChangeDialog.onDiscard}
          onCancel={unsavedChangeDialog.onCancel}
          slotProps={unsavedDialogSlotProps}
        />
      ) : null}
    </>
  );
};

PluginDialogShell.displayName = 'PluginDialogShell';
