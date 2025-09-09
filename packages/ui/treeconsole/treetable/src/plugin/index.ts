/**
  * Plugin System Exports
  * TreeTableAPI
  */

// Core plugin system
export { PluginRegistry } from './PluginRegistry';
export {
  PluginProvider,
  usePluginContext,
  usePluginRegistry,
  usePlugin,
  usePluginHooks,
  usePluginEnabled,
  withPlugins,
} from './PluginProvider';
export {
  useOptionalPluginContext,
  usePluginsEnabled,
  useSafePluginHook,
} from './useOptionalPluginContext';

// Type definitions
export type {
  TreeTablePlugin,
  TreeTableHooks,
  TreeTableComponentOverrides,
  PluginRegistry as IPluginRegistry,
  PluginContext,
  CellEditorProps,
  RowDecoratorProps,
  ColumnHeaderProps,
  LoadingIndicatorProps,
  ErrorBoundaryProps,
  KeyboardContext,
  PluginConfig,
  TreeTablePluginConfig,
  PluginEvent,
  HookExecutionResult,
  PluginLifecycleState,
  HookExecutionMode,
  PluginPriority,
  PluginError,
  PluginRegistrationError,
  HookExecutionError,
} from './types';

//  Plugin-enhanced components ()
export {
  InlineEditableTreeTable,
  KeyboardNavigableTreeTable,
  AdvancedTreeTable,
} from '../components/TreeTableCoreWithPlugins';

// Utility functions
export function createPlugin(
  name: string,
  version: string,
  hooks: import('./types').TreeTableHooks,
  options?: {
    components?: import('./types').TreeTableComponentOverrides;
    dependencies?: string[];
    config?: Record<string, any>;
  },
): import('./types').TreeTablePlugin {
  return {
    name,
    version,
    hooks,
    components: options?.components,
    dependencies: options?.dependencies,
    config: options?.config,
  };
}

/**
    */
export const PluginHelpers = {
  /**
            */
  createSimplePlugin: createPlugin,

  /**
            */
  createHook<T extends keyof import('./types').TreeTableHooks>(
    hookName: T,
    implementation: NonNullable<import('./types').TreeTableHooks[T]>,
  ) {
    return { [hookName]: implementation } as Pick<import('./types').TreeTableHooks, T>;
  },

  /**
            */
  validateDependencies(
    plugin: import('./types').TreeTablePlugin,
    availablePlugins: string[],
  ): { isValid: boolean; missingDependencies: string[] } {
    const missing = plugin.dependencies?.filter(dep => !availablePlugins.includes(dep)) || [];
    return {
      isValid: missing.length === 0,
      missingDependencies: missing,
    };
  },

  /**
            */
  checkCompatibility(
    plugin: import('./types').TreeTablePlugin,
    targetVersion: string,
  ): boolean {
    //  semver
    const [major] = plugin.version.split('.');
    const [targetMajor] = targetVersion.split('.');
    return major === targetMajor;
  },
};