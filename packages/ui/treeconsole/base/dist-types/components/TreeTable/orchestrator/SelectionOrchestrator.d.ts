/**
  * SelectionOrchestrator
   * -
 * -
 * - /
 * -
  */
import type { TreeViewController } from '../../../types/index.js';
export interface SelectionOrchestratorResult {
    selectedNodeIds: string[];
    selectionMode: 'none' | 'single' | 'multiple';
    selectNode: (nodeId: string) => void;
    selectMultipleNodes: (nodeIds: string[]) => void;
    clearSelection: () => void;
    selectAll: () => void;
    toggleSelection: (nodeId: string) => void;
}
/**
    */
export declare function useSelectionOrchestrator(controller: TreeViewController | null): SelectionOrchestratorResult;
//# sourceMappingURL=SelectionOrchestrator.d.ts.map