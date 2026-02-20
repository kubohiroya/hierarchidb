/**
 * @file AbstractDialog.tsx
 * @description Shared dialog context provider for PluginDialog and modeless dialogs.
 */

import { Fragment } from 'react';
import { PluginDialogProvider } from '~/hooks/useDialogContext';
import type { HeadlessDialogProps } from './types.js';
import { useAbstractDialog } from './useAbstractDialog.js';
import { AbstractDialogContent, AbstractDialogFooter, AbstractDialogHeader } from './AbstractDialogElements.js';

/**
 * Headless dialog container. Renders provided header/content/footer components
 * inside a context provider so that each layer can access dialog atoms and callbacks.
 */
export function AbstractDialog<TData>(props: HeadlessDialogProps<TData>) {
  const { contextValue, headerProps, contentProps, footerProps } = useAbstractDialog(props);

  return (
    <PluginDialogProvider value={contextValue}>
      <Fragment><AbstractDialogHeader {...headerProps} /></Fragment>
      <Fragment><AbstractDialogContent {...contentProps} /></Fragment>
      <Fragment><AbstractDialogFooter {...footerProps} /></Fragment>
    </PluginDialogProvider>
  );
}
