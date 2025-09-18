import React from 'react';
import { HeadlessMultiStepDialog } from '@hierarchidb/ui-dialog';
import type { PluginDialogControllerOptions } from './usePluginDialogController.js';
import { usePluginDialogController } from './usePluginDialogController.js';

export type PluginDialogShellProps = PluginDialogControllerOptions;

export const PluginDialogShell: React.FC<PluginDialogShellProps> = (props) => {
  const { headlessProps } = usePluginDialogController(props);

  return <HeadlessMultiStepDialog {...headlessProps} />;
};

PluginDialogShell.displayName = 'PluginDialogShell';
