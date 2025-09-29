/**
  * EditingOrchestrator
   * - /
 * -
 * - /
  */
import type { TreeViewController } from '../../../types/index.js';
export interface EditingOrchestratorResult {
    editingNodeId: string | null;
    editingValue: string;
    isEditing: boolean;
    startEdit: (nodeId: string, initialValue: string) => void;
    updateValue: (value: string) => void;
    confirmEdit: () => Promise<void>;
    cancelEdit: () => void;
}
/**
    */
export declare function useEditingOrchestrator(controller: TreeViewController | null): EditingOrchestratorResult;
//# sourceMappingURL=EditingOrchestrator.d.ts.map