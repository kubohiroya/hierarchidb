/**
  * TreeTableCore with Optional Plugin Support
  * TreeTableCore
   */

import { TreeTableCore as TreeTableCoreOriginal } from './TreeTableCore';
import { PluginProvider } from '../plugin/PluginProvider';
import type { TreeTableCoreProps } from '../types';
import type { PluginEvent, TreeTablePlugin, TreeTablePluginConfig } from '../plugin/types';

export interface TreeTableCorePropsWithPlugins extends TreeTableCoreProps {
  /**
            */
  plugins?: TreeTablePlugin[];

  /**
            */
  pluginConfig?: TreeTablePluginConfig;

  /**
            */
  onPluginEvent?: (event: PluginEvent) => void;

  /**
      * : false
      */
  enablePlugins?: boolean;

  /**
            */
  debugPlugins?: boolean;
}

/**
  * TreeTableCore
  * Provider
 * TreeTableCore
  */
export function TreeTableCoreWithPlugins(props: TreeTableCorePropsWithPlugins) {
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
function TreeTableCoreWithPluginContext(props: TreeTableCoreProps) {
  return <TreeTableCoreOriginal {...props} />;
}

// =============================================================================
//  Convenience Components (TreeTableWithPlugins)
// =============================================================================

/**
  * TreeTable
 * @deprecated TreeTableCoreWithPluginsinlineEditPlugin
  */
export function InlineEditableTreeTable(props: TreeTableCorePropsWithPlugins) {
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
export function KeyboardNavigableTreeTable(props: TreeTableCorePropsWithPlugins) {
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
export function AdvancedTreeTable(props: TreeTableCorePropsWithPlugins) {
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

export default TreeTableCoreWithPlugins;