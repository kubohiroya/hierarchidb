/**
  * ExpansionOrchestrator
  * /
 * - /
 * - /
 * -
  */
import type { TreeViewController } from '../../../types/index.js';
export interface ExpansionOrchestratorResult {
    expanded: Record<string, boolean>;
    toggleNode: (nodeId: string) => void;
    expandNode: (nodeId: string) => void;
    collapseNode: (nodeId: string) => void;
    toggleAllNodes: () => void;
    expandAllNodes: () => void;
    collapseAllNodes: () => void;
}
/**
    */
export declare function useExpansionOrchestrator(controller: TreeViewController | null): ExpansionOrchestratorResult;
//# sourceMappingURL=ExpansionOrchestrator.d.ts.map