/**
 * @hierarchidb/ui-treeconsole-treetable
 *
 * TreeTable component for HierarchiDB TreeConsole
 */

// Main components
export { TreeTableCore } from './components/TreeTableCore.js';
export { TreeTableCoreWithPlugins } from './components/TreeTableCoreWithPlugins.js';
export type { TreeTableCorePropsWithPlugins } from './components/TreeTableCoreWithPlugins.js';

// Orchestrator
export { useTreeTableOrchestrator } from './orchestrator/index.js';
export type { TreeTableOrchestratorResult } from './orchestrator/index.js';

// State management
export * from './state/index.js';
export { getColumnWidths, saveColumnWidths, removeColumnWidths, removeColumnWidthsMany } from './state/column-widths-db.js';
export { getProperties, saveProperties } from './state/properties-db.js';

// Utilities
export * from './utils/index.js';

// Plugin System
export * from './plugin/index.js';

// Built-in Plugins
export * from './plugins/index.js';

// Types
export type {
  TreeNodeInUI,
  TreeTableController,
  TreeTableCoreProps,
  TreeTableColumn,
  SelectionState,
  ExpansionState,
  EditingState,
  DragDropState,
  SearchState,
} from './types.js';
