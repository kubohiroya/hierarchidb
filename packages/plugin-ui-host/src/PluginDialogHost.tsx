import {
  hydratePresentationDefinitionsFromGlobal,
  prefetchAllIcons,
} from '@hierarchidb/plugin-presentation';
import React from 'react';
import { PluginDialogShell, type PluginDialogShellProps } from './headless/PluginDialogShell.js';

export interface PluginDialogHostProps extends PluginDialogShellProps {
  prefetchIcons?: boolean;
}

export const PluginDialogHost: React.FC<PluginDialogHostProps> = ({
  prefetchIcons = true,
  ...rest
}) => {
  React.useEffect(() => {
    hydratePresentationDefinitionsFromGlobal();
    if (!prefetchIcons) return;
    // Fire-and-forget – host environments may not define all icons.
    prefetchAllIcons().catch((err: unknown) => {
      if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn('[PluginDialogHost] prefetchAllIcons failed', err);
      }
    });
  }, [prefetchIcons]);

  return <PluginDialogShell {...rest} />;
};

PluginDialogHost.displayName = 'PluginDialogHost';
