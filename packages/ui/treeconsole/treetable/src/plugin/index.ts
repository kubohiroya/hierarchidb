/**
  * Plugin System Exports
  * TreeTableAPI
  */

// Core plugin system
export { PluginRegistry } from './PluginRegistry.js';
export {
  PluginProvider,
  usePluginContext,
  usePluginRegistry,
  usePlugin,
  usePluginHooks,
  usePluginEnabled,
  withPlugins,
} from './PluginProvider.js';
export {
  useOptionalPluginContext,
  usePluginsEnabled,
  useSafePluginHook,
} from './useOptionalPluginContext.js';

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
} from './types.js';

//  Plugin-enhanced components ()
export {
  InlineEditableTreeTable,
  KeyboardNavigableTreeTable,
  AdvancedTreeTable,
} from '../components/TreeTableCoreWithPlugins.js';

// Utility functions
export function createPlugin(
  name: string,
  version: string,
  hooks: import('./types.js').TreeTableHooks,
  options?: {
    components?: import('./types.js').TreeTableComponentOverrides;
    dependencies?: string[];
    config?: Record<string, unknown>;
  },
): import('./types.js').TreeTablePlugin {
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
  createHook<T extends keyof import('./types.js').TreeTableHooks>(
    hookName: T,
    implementation: NonNullable<import('./types.js').TreeTableHooks[T]>,
  ) {
    return { [hookName]: implementation } as Pick<import('./types.js').TreeTableHooks, T>;
  },

  /**
            */
  validateDependencies(
    plugin: import('./types.js').TreeTablePlugin,
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
    plugin: import('./types.js').TreeTablePlugin,
    targetVersion: string,
  ): boolean {
    //  semver
    const [major] = plugin.version.split('.');
    const [targetMajor] = targetVersion.split('.');
    return major === targetMajor;
  },
};

// Built-in plugins (to avoid confusion with the plugin system folder itself)
export * as BuiltinPlugins from './builtins/index.js';
export * from './builtins/index.js';
