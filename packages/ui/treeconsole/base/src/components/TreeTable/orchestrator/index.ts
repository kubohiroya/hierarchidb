/**
  * TreeTableOrchestrator (Facade)
     * :
 * -
 * - UI
 * -
  */

import { useMemo } from 'react';
import type { TreeViewController } from '../../../types/index.js';
import type { WorkerAPI } from '@hierarchidb/worker-api';
import { useAtomValue } from 'jotai';
import { tableDataAtom } from '../state/index.js';

// Individual Orchestrators
import { type SelectionOrchestratorResult, useSelectionOrchestrator } from './SelectionOrchestrator.js';
import { type ExpansionOrchestratorResult, useExpansionOrchestrator } from './ExpansionOrchestrator.js';
import { type EditingOrchestratorResult, useEditingOrchestrator } from './EditingOrchestrator.js';
import { type DragDropOrchestratorResult, useDragDropOrchestrator } from './DragDropOrchestrator.js';
import { type SearchOrchestratorResult, useSearchOrchestrator } from './SearchOrchestrator.js';
import { type SubscriptionOrchestratorResult, useSubscriptionOrchestrator } from './SubscriptionOrchestrator.js';

/**
    */
export interface TreeTableOrchestratorResult {
  //  Sub-orchestrators ()
  selection: SelectionOrchestratorResult;
  expansion: ExpansionOrchestratorResult;
  editing: EditingOrchestratorResult;
  dragDrop: DragDropOrchestratorResult;
  search: SearchOrchestratorResult;
  subscription: SubscriptionOrchestratorResult;

  //  Commonly used shortcuts ()
  selectedNodeIds: string[];
  isLoading: boolean;
  error: string | null;
}

/**
  * TreeTableOrchestrator Hook (Facade)
  * :
 * ```typescript
 * const orchestrator = useTreeTableOrchestrator(controller, workerAPI);
  * //
 * orchestrator.selection.selectNode(nodeId);
 * orchestrator.expansion.toggleNode(nodeId);
 * orchestrator.editing.startEdit(nodeId, value);
  * //
 * const { selectedNodeIds, isLoading } = orchestrator;
 * ```
  */
export function useTreeTableOrchestrator<T>(
  controller: TreeViewController | null,
  workerAPI: WorkerAPI<T>,
  _options?: {
    enableSubscription?: boolean;
    subscriptionDepth?: number;
  },
): TreeTableOrchestratorResult {
  // Get table data for orchestrators that need it
  const tableData = useAtomValue(tableDataAtom);

  // Initialize individual orchestrators
  const selection = useSelectionOrchestrator(controller);
  const expansion = useExpansionOrchestrator(controller);
  const editing = useEditingOrchestrator(controller);
  const dragDrop = useDragDropOrchestrator(controller, tableData);
  const search = useSearchOrchestrator(controller);
  const subscription = useSubscriptionOrchestrator(workerAPI);

  // Create facade result
  const result = useMemo<TreeTableOrchestratorResult>(
    () => ({
      // Sub-orchestrators
      selection,
      expansion,
      editing,
      dragDrop,
      search,
      subscription,

      // Common shortcuts
      selectedNodeIds: selection.selectedNodeIds,
      isLoading: false, // TODO: Implement loading atoms
      error: null, // TODO: Implement error atoms
    }),
    [selection, expansion, editing, dragDrop, search, subscription],
  );

  return result;
}

// Re-export individual orchestrator types for convenience
export type {
  SelectionOrchestratorResult,
  ExpansionOrchestratorResult,
  EditingOrchestratorResult,
  DragDropOrchestratorResult,
  SearchOrchestratorResult,
  SubscriptionOrchestratorResult,
};
