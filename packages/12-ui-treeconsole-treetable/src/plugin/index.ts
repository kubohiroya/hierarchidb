/**
 * Plugin System Exports
 * 
 * TreeTableプラグインシステムの公開API
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
  withPlugins 
} from './PluginProvider';

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

// Plugin-enhanced components
export {
  TreeTableWithPlugins,
  InlineEditableTreeTable,
  KeyboardNavigableTreeTable,
  AdvancedTreeTable,
} from '../components/TreeTableWithPlugins';

// Utility functions
export function createPlugin(
  name: string,
  version: string,
  hooks: import('./types').TreeTableHooks,
  options?: {
    components?: import('./types').TreeTableComponentOverrides;
    dependencies?: string[];
    config?: Record<string, any>;
  }
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
 * プラグイン開発用のヘルパー関数
 */
export const PluginHelpers = {
  /**
   * 簡単なプラグインを作成
   */
  createSimplePlugin: createPlugin,

  /**
   * フック関数の作成ヘルパー
   */
  createHook<T extends keyof import('./types').TreeTableHooks>(
    hookName: T,
    implementation: NonNullable<import('./types').TreeTableHooks[T]>
  ) {
    return { [hookName]: implementation } as Pick<import('./types').TreeTableHooks, T>;
  },

  /**
   * プラグインの依存関係チェック
   */
  validateDependencies(
    plugin: import('./types').TreeTablePlugin,
    availablePlugins: string[]
  ): { isValid: boolean; missingDependencies: string[] } {
    const missing = plugin.dependencies?.filter(dep => !availablePlugins.includes(dep)) || [];
    return {
      isValid: missing.length === 0,
      missingDependencies: missing,
    };
  },

  /**
   * プラグインの互換性チェック
   */
  checkCompatibility(
    plugin: import('./types').TreeTablePlugin,
    targetVersion: string
  ): boolean {
    // 簡単なバージョン互換性チェック
    // 実際の実装では、semverライブラリを使用することを推奨
    const [major] = plugin.version.split('.');
    const [targetMajor] = targetVersion.split('.');
    return major === targetMajor;
  },
};