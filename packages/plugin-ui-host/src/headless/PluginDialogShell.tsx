import { MultiStepDialogFrame } from '@hierarchidb/ui-dialog';
import type React from 'react';
import { UnsavedChangesDialog } from '@hierarchidb/ui-dialog';
import type { PluginDialogControllerOptions } from './usePluginDialogController.js';
import { usePluginDialogController } from './usePluginDialogController.js';

export type PluginDialogShellProps = PluginDialogControllerOptions;

export const PluginDialogShell: React.FC<PluginDialogShellProps> = (props) => {
  const { headlessProps, unsavedChangeDialog } = usePluginDialogController(props);
  return (
    <>
      <MultiStepDialogFrame headlessProps={headlessProps} />
      {unsavedChangeDialog ? (
        <UnsavedChangesDialog
          open={unsavedChangeDialog.open}
          title={unsavedChangeDialog.title}
          message={unsavedChangeDialog.message}
          onDiscard={unsavedChangeDialog.onDiscard}
          onCancel={unsavedChangeDialog.onCancel}
        />
      ) : null}
    </>
  );
};

PluginDialogShell.displayName = 'PluginDialogShell';
