/**
  * TreeTableOrchestrator (Facade)
     * :
 * -
 * - UI
 * -
  */
import type { TreeViewController } from '../../../types/index.js';
import type { WorkerAPI } from '@hierarchidb/common-api';
import { type SelectionOrchestratorResult } from './SelectionOrchestrator.js';
import { type ExpansionOrchestratorResult } from './ExpansionOrchestrator.js';
import { type EditingOrchestratorResult } from './EditingOrchestrator.js';
import { type DragDropOrchestratorResult } from './DragDropOrchestrator.js';
import { type SearchOrchestratorResult } from './SearchOrchestrator.js';
import { type SubscriptionOrchestratorResult } from './SubscriptionOrchestrator.js';
/**
    */
export interface TreeTableOrchestratorResult {
    selection: SelectionOrchestratorResult;
    expansion: ExpansionOrchestratorResult;
    editing: EditingOrchestratorResult;
    dragDrop: DragDropOrchestratorResult;
    search: SearchOrchestratorResult;
    subscription: SubscriptionOrchestratorResult;
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
export declare function useTreeTableOrchestrator(controller: TreeViewController | null, workerAPI?: WorkerAPI, _options?: {
    enableSubscription?: boolean;
    subscriptionDepth?: number;
}): TreeTableOrchestratorResult;
export type { SelectionOrchestratorResult, ExpansionOrchestratorResult, EditingOrchestratorResult, DragDropOrchestratorResult, SearchOrchestratorResult, SubscriptionOrchestratorResult, };
//# sourceMappingURL=index.d.ts.map