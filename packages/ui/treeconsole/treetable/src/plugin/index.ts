/**
 * Plugin System Exports
 * TreeTableAPI
 */

export {
  PluginProvider,
  usePlugin,
  usePluginContext,
  usePluginEnabled,
  usePluginHooks,
  usePluginRegistry,
  withPlugins,
} from './PluginProvider.js';
// Core plugin system
export { PluginRegistry } from './PluginRegistry.js';
// Type definitions
export type {
  CellEditorProps,
  ColumnHeaderProps,
  ErrorBoundaryProps,
  HookExecutionError,
  HookExecutionMode,
  HookExecutionResult,
  KeyboardContext,
  LoadingIndicatorProps,
  PluginConfig,
  PluginContext,
  PluginError,
  PluginEvent,
  PluginLifecycleState,
  PluginPriority,
  PluginRegistrationError,
  PluginRegistry as IPluginRegistry,
  RowDecoratorProps,
  TreeTableComponentOverrides,
  TreeTableHooks,
  TreeTablePlugin,
  TreeTablePluginConfig,
} from './types.js';
export {
  useOptionalPluginContext,
  usePluginsEnabled,
  useSafePluginHook,
} from './useOptionalPluginContext.js';

//  Plugin-enhanced components ()
// Thin wrapper components removed; use TreeTableCoreWithPlugins directly.

// Utility functions
export function createPlugin(
  name: string,
  version: string,
  hooks: import('./types.js').TreeTableHooks,
  options?: {
    components?: import('./types.js').TreeTableComponentOverrides;
    dependencies?: string[];
    config?: Record<string, unknown>;
  }
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
    implementation: NonNullable<import('./types.js').TreeTableHooks[T]>
  ) {
    return { [hookName]: implementation } as Pick<import('./types.js').TreeTableHooks, T>;
  },

  /**
   */
  validateDependencies(
    plugin: import('./types.js').TreeTablePlugin,
    availablePlugins: string[]
  ): { isValid: boolean; missingDependencies: string[] } {
    const missing = plugin.dependencies?.filter((dep) => !availablePlugins.includes(dep)) || [];
    return {
      isValid: missing.length === 0,
      missingDependencies: missing,
    };
  },

  /**
   */
  checkCompatibility(plugin: import('./types.js').TreeTablePlugin, targetVersion: string): boolean {
    //  semver
    const [major] = plugin.version.split('.');
    const [targetMajor] = targetVersion.split('.');
    return major === targetMajor;
  },
};

// Built-in plugins (to avoid confusion with the plugin system folder itself)
export * as BuiltinPlugins from './builtins/index.js';
export * from './builtins/InlineEditPlugin.js';
export * from './builtins/KeyboardNavigationPlugin.js';
export * from './builtins/defaultPlugins.js';
