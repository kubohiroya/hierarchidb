import { PluginDialogFrame } from '@hierarchidb/ui-dialog';
import type React from 'react';
import { UnsavedChangesDialog } from '@hierarchidb/ui-dialog';
import type { PluginDialogControllerOptions } from './usePluginDialogController.js';
import { usePluginDialogController } from './usePluginDialogController.js';
import type { Theme } from '@mui/material';

export type PluginDialogShellProps = PluginDialogControllerOptions;

export const PluginDialogShell: React.FC<PluginDialogShellProps> = (props) => {
  const { headlessProps, unsavedChangeDialog, conflictDialog } = usePluginDialogController(props);

  const backdropSx = unsavedChangeDialog?.open
    ? { pointerEvents: 'none' as const }
    : undefined;

  const unsavedDialogSlotProps = {
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
      <PluginDialogFrame headlessProps={headlessProps} backdropSx={backdropSx} />
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
