/**
 * @file AbstractDialog.tsx
 * @description Shared dialog context provider for PluginDialog and modeless dialogs.
 */

import { Fragment } from 'react';
import { PluginDialogProvider } from '../hooks/useDialogContext.js';
import type { HeadlessDialogProps } from './types.js';
import { useAbstractDialog } from './useAbstractDialog.js';

/**
 * Headless dialog container. Renders provided header/content/footer components
 * inside a context provider so that each layer can access dialog atoms and callbacks.
 */
export function AbstractDialog<TData>(props: HeadlessDialogProps<TData>) {
  const { contextValue, headerElement, contentElement, footerElement } = useAbstractDialog(props);

  return (
    <PluginDialogProvider value={contextValue}>
      <Fragment>{headerElement}</Fragment>
      <Fragment>{contentElement}</Fragment>
      <Fragment>{footerElement}</Fragment>
    </PluginDialogProvider>
  );
}
