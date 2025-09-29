import type { NodeId, TreeNode } from '@hierarchidb/common-type';
import type { WorkerAPIAdapter } from '../adapters/index.js';
type StateManagerLike = Partial<{
    moveNode: (nodeId: NodeId, targetParentId: NodeId, index: number) => Promise<void> | void;
    deleteNode: (nodeId: NodeId) => Promise<void> | void;
    duplicateNode: (nodeId: NodeId) => Promise<void> | void;
}>;
export interface UseCRUDOperationsOptions {
    stateManager?: StateManagerLike;
    /** Worker API adapter */
    workerAdapter?: WorkerAPIAdapter;
    /** Loading state setter */
    setIsLoading?: (loading: boolean) => void;
    /** Callback to update selected nodes */
    onSelectedNodesChange?: (updater: (prev: NodeId[]) => NodeId[]) => void;
    /** Callback to update expanded nodes */
    onExpandedNodesChange?: (updater: (prev: NodeId[]) => NodeId[]) => void;
    /** Callback to update current node */
    onCurrentNodeChange?: (updater: (prev: TreeNode | null) => TreeNode | null) => void;
}
export interface UseCRUDOperationsReturn {
    moveNode: (nodeId: NodeId, targetParentId: NodeId, index?: number) => Promise<void>;
    moveNodes: (nodeIds: NodeId[], targetParentId: NodeId) => Promise<void>;
    deleteNode: (nodeId: NodeId) => Promise<void>;
    deleteNodes: (nodeIds: NodeId[]) => Promise<void>;
    duplicateNode: (nodeId: NodeId) => Promise<void>;
    duplicateNodes: (nodeIds: NodeId[], targetParentId: NodeId) => Promise<void>;
    startEdit: (nodeId: NodeId) => Promise<void>;
    startCreate: (parentId: NodeId, name: string) => Promise<void>;
}
export declare function useCRUDOperations(options?: UseCRUDOperationsOptions): UseCRUDOperationsReturn;
export {};
//# sourceMappingURL=useCRUDOperations.d.ts.map