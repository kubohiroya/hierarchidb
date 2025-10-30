import React from 'react';
import { PluginDialogShell, type PluginDialogShellProps } from './headless/PluginDialogShell.js';
import { prefetchAllIcons, hydratePresentationDefinitionsFromGlobal } from '@hierarchidb/plugin-presentation';

export interface PluginDialogHostProps extends PluginDialogShellProps {
  /**
   * Whether to trigger icon prefetch on mount. Enabled by default so the
   * surrounding app gets consistent iconography as soon as any dialog opens.
   */
  prefetchIcons?: boolean;
}

export const PluginDialogHost: React.FC<PluginDialogHostProps> = ({ prefetchIcons = true, ...rest }) => {
  React.useEffect(() => {
    hydratePresentationDefinitionsFromGlobal();
    if (!prefetchIcons) return;
    // Fire-and-forget – host environments may not define all icons.
    prefetchAllIcons().catch((err) => {
      if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn('[PluginDialogHost] prefetchAllIcons failed', err);
      }
    });
  }, [prefetchIcons]);

  return <PluginDialogShell {...rest} />;
};

PluginDialogHost.displayName = 'PluginDialogHost';
