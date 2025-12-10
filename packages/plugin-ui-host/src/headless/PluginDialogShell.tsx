import { MultiStepDialogFrame } from '@hierarchidb/ui-dialog';
import type React from 'react';
import { UnsavedChangesDialog } from '@hierarchidb/ui-dialog';
import type { PluginDialogControllerOptions } from './usePluginDialogController.js';
import { usePluginDialogController } from './usePluginDialogController.js';

export type PluginDialogShellProps = PluginDialogControllerOptions;

export const PluginDialogShell: React.FC<PluginDialogShellProps> = (props) => {
  const { headlessProps, unsavedChangeDialog } = usePluginDialogController(props);

  const backdropSx = unsavedChangeDialog?.open
    ? { pointerEvents: 'none' as const }
    : undefined;

  const unsavedDialogSlotProps = {
    backdrop: {
      sx: {
        zIndex: (theme: any) => (theme?.zIndex?.modal ?? 1300) + 8000,
      },
    },
    paper: {
      sx: {
        zIndex: (theme: any) => (theme?.zIndex?.modal ?? 1300) + 8001,
      },
    },
  } as const;
  return (
    <>
      <MultiStepDialogFrame headlessProps={headlessProps} backdropSx={backdropSx} />
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
