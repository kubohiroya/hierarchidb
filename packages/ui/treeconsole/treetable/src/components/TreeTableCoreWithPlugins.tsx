/**
  * TreeTableCore with Optional Plugin Support
  * TreeTableCore
   */

import { TreeTableCore as TreeTableCoreOriginal } from './TreeTableCore.js';
import type { ReactElement } from 'react';
import { PluginProvider } from '~/plugin/PluginProvider';
import type { TreeTableCoreProps } from '~/types';
import type { PluginEvent, TreeTablePlugin, TreeTablePluginConfig } from '~/plugin/types';

export interface TreeTableCorePropsWithPlugins extends TreeTableCoreProps {
  plugins?: TreeTablePlugin[];
  pluginConfig?: TreeTablePluginConfig;
  onPluginEvent?: (event: PluginEvent) => void;
  enablePlugins?: boolean;
  debugPlugins?: boolean;
}

/**
  * TreeTableCore
  * Provider
 * TreeTableCore
  */
export function TreeTableCoreWithPlugins(props: TreeTableCorePropsWithPlugins): ReactElement {
  const {
    plugins,
    pluginConfig,
    onPluginEvent,
    enablePlugins = false,
    debugPlugins = false,
    ...coreProps
  } = props;

  //  Provider
  if (enablePlugins && plugins && plugins.length > 0) {
    return (
      <PluginProvider
        plugins={plugins}
        config={pluginConfig}
        onPluginEvent={onPluginEvent}
        debugMode={debugPlugins}
      >
        <TreeTableCoreOriginal {...coreProps} />
      </PluginProvider>
    );
  }

  return <TreeTableCoreOriginal {...coreProps} />;
}
