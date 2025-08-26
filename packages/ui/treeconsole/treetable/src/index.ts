/**
 * @hierarchidb/ui-treeconsole-treetable
 *
 * TreeTable component for HierarchiDB TreeConsole
 */

// Main components
export { TreeTableCore } from './components/TreeTableCore';
export { TreeTableCoreWithPlugins } from './components/TreeTableCoreWithPlugins';
export type { TreeTableCorePropsWithPlugins } from './components/TreeTableCoreWithPlugins';

// Orchestrator
export { useTreeTableOrchestrator } from './orchestrator';
export type { TreeTableOrchestratorResult } from './orchestrator';

// State management
export * from './state';

// Utilities
export * from './utils';

// Plugin System
export * from './plugin';

// Built-in Plugins
export * from './plugins';

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
} from './types';
