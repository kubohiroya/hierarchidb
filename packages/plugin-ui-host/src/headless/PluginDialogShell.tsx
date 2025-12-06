import { MultiStepDialogFrame } from '@hierarchidb/ui-dialog';
import type React from 'react';
import type { PluginDialogControllerOptions } from './usePluginDialogController.js';
import { usePluginDialogController } from './usePluginDialogController.js';

export type PluginDialogShellProps = PluginDialogControllerOptions;

export const PluginDialogShell: React.FC<PluginDialogShellProps> = (props) => {
  const { headlessProps } = usePluginDialogController(props);
  return <MultiStepDialogFrame headlessProps={headlessProps} />;
};

PluginDialogShell.displayName = 'PluginDialogShell';
