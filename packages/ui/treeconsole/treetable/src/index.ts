/**
 * @hierarchidb/ui-treeconsole-treetable
 *
 * TreeTable component for HierarchiDB TreeConsole
 */

// Main components
export { TreeTableCore } from './components/TreeTableCore.js';
export type { TreeTableCorePropsWithPlugins } from './components/TreeTableCoreWithPlugins.js';
export { TreeTableCoreWithPlugins } from './components/TreeTableCoreWithPlugins.js';
export type { TreeTableOrchestratorResult } from './types.js';
// Orchestrator
export { useTreeTableOrchestrator } from './orchestrator/index.js';
// Built-in Plugins
export * from './plugin/builtins/InlineEditPlugin.js';
export * from './plugin/builtins/KeyboardNavigationPlugin.js';
export * from './plugin/builtins/defaultPlugins.js';
// Plugin System
export * from './plugin/PluginProvider.js';
export * from './plugin/PluginRegistry.js';
export type {
  PluginConfig,
  PluginContext,
  PluginEvent,
  PluginLifecycleState,
  PluginPriority,
  PluginRegistry,
  TreeTablePlugin,
  TreeTablePluginConfig,
} from './plugin/types.js';
export * from './plugin/useOptionalPluginContext.js';
export {
  getColumnWidths,
  removeColumnWidths,
  removeColumnWidthsMany,
  saveColumnWidths,
} from './state/column-widths-db.js';
// State management
export * from './state/index.js';
export { getProperties, saveProperties } from './state/properties-db.js';
// Types
export type {
  BuildSessionIndicator,
  DragDropState,
  EditingState,
  ExpansionState,
  SearchState,
  SelectionState,
  TreeNodeInUI,
  TreeTableColumn,
  TreeTableController,
  TreeTableCoreProps,
} from './types.js';
// Utilities
export * from './utils/descendants.js';
