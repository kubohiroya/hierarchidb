import type React from 'react';
import { DialogOverlayFrame } from '@hierarchidb/ui-dialog';
import type { PluginDialogControllerOptions } from './usePluginDialogController.js';
import { usePluginDialogController } from './usePluginDialogController.js';

export type PluginDialogShellProps = PluginDialogControllerOptions;

export const PluginDialogShell: React.FC<PluginDialogShellProps> = (props) => {
  const { headlessProps } = usePluginDialogController(props);
  return <DialogOverlayFrame headlessProps={headlessProps} />;
};

PluginDialogShell.displayName = 'PluginDialogShell';
