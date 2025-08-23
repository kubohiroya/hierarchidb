/**
 * @hierarchidb/ui-treeconsole-treetable
 *
 * TreeTable component for HierarchiDB TreeConsole
 */

// Main component
export { TreeTableCore } from './components/TreeTableCore';

// Orchestrator
export { useTreeTableOrchestrator } from './orchestrator';
export type { TreeTableOrchestratorResult } from './orchestrator';

// State management
export * from './state';

// Utilities
export * from './utils';

// Plugin System
export * from './plugin';

// Types
export type {
  TreeNode,
  TreeTableController,
  TreeTableCoreProps,
  TreeTableColumn,
  SelectionState,
  ExpansionState,
  EditingState,
  DragDropState,
  SearchState,
} from './types';
