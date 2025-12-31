/**
  * TreeTableCore with Optional Plugin Support
  * TreeTableCore
   */

import { TreeTableCore as TreeTableCoreOriginal } from './TreeTableCore.js';
import type { ReactElement } from 'react';
import { PluginProvider } from '../plugin/PluginProvider.js';
import type { TreeTableCoreProps } from '../types.js';
import type { PluginEvent, TreeTablePlugin, TreeTablePluginConfig } from '../plugin/types.js';

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
        <TreeTableCoreWithPluginContext {...coreProps} />
      </PluginProvider>
    );
  }

  return <TreeTableCoreOriginal {...coreProps} />;
}

/**
  * TreeTableCore
   */
function TreeTableCoreWithPluginContext(props: TreeTableCoreProps): ReactElement {
  return <TreeTableCoreOriginal {...props} />;
}

// =============================================================================
//  Convenience Components (TreeTableWithPlugins)
// =============================================================================

/**
  * TreeTable
 * @deprecated TreeTableCoreWithPluginsinlineEditPlugin
  */
export function InlineEditableTreeTable(props: TreeTableCorePropsWithPlugins): ReactElement {
  const plugins = props.plugins || [];
  return (
    <TreeTableCoreWithPlugins
      {...props}
      enablePlugins={true}
      plugins={plugins}
    />
  );
}

/**
  * TreeTable
 * @deprecated TreeTableCoreWithPluginskeyboardNavigationPlugin
  */
export function KeyboardNavigableTreeTable(props: TreeTableCorePropsWithPlugins): ReactElement {
  const plugins = props.plugins || [];
  return (
    <TreeTableCoreWithPlugins
      {...props}
      enablePlugins={true}
      plugins={plugins}
    />
  );
}

/**
  * TreeTable
 * @deprecated TreeTableCoreWithPluginsfullFeaturedPlugins
  */
export function AdvancedTreeTable(props: TreeTableCorePropsWithPlugins): ReactElement {
  const plugins = props.plugins || [];
  return (
    <TreeTableCoreWithPlugins
      {...props}
      enablePlugins={true}
      plugins={plugins}
      debugPlugins={props.debugPlugins || false}
    />
  );
}
