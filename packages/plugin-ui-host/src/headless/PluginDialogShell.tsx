import { PluginDialogFrame, UnsavedChangesDialog } from '@hierarchidb/ui-dialog';
import type React from 'react';
import { PluginDialogConflictDialog } from './PluginDialogControllerElements.js';
import type { PluginDialogShellProps } from './pluginDialogShellTypes.js';
import { usePluginDialogShell } from './usePluginDialogShell.js';

export const PluginDialogShell: React.FC<PluginDialogShellProps> = (props) => {
  const {
    headlessProps,
    unsavedChangeDialog,
    conflictDialog,
    backdropSx,
    unsavedDialogSlotProps,
    backdropDismissEnabled,
  } = usePluginDialogShell(props);
  return (
    <>
      <PluginDialogFrame
        headlessProps={headlessProps}
        backdropSx={backdropSx}
        backdropDismissEnabled={backdropDismissEnabled}
      />
      {conflictDialog ? <PluginDialogConflictDialog {...conflictDialog} /> : null}
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
