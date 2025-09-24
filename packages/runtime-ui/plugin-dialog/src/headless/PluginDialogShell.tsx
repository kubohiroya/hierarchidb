import React from 'react';
import { MultiDialogFrame } from '@hierarchidb/ui-dialog';
import type { PluginDialogControllerOptions } from './usePluginDialogController.js';
import { usePluginDialogController } from './usePluginDialogController.js';

export type PluginDialogShellProps = PluginDialogControllerOptions;

export const PluginDialogShell: React.FC<PluginDialogShellProps> = (props) => {
  const { headlessProps } = usePluginDialogController(props);
  return (
    <MultiDialogFrame
      headlessProps={headlessProps}
    />
  );
};

PluginDialogShell.displayName = 'PluginDialogShell';

export default PluginDialogShell;
