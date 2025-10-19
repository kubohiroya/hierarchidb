/**
 * Working Copy Hook
 * Manages working copy lifecycle for dialog editing with Worker communication
 */
import { NodeId, TreeId } from '@hierarchidb/common-types';
import type { WorkerClientRef } from '@hierarchidb/runtime-client';
export interface WorkingCopyData {
    treeNodeId: NodeId;
    name: string;
    description?: string;
    data?: Record<string, unknown>;
    isDraft?: boolean;
}
export interface UseWorkingCopyOptions {
    mode: 'create' | 'edit';
    nodeType: string;
    nodeId?: NodeId;
    parentId?: NodeId;
    treeId: TreeId;
    /** Optional Worker client holder provided by host component */
    workerClient?: WorkerClientRef | null;
}
export interface UseWorkingCopyResult {
    workingCopy: WorkingCopyData | null;
    hasUnsavedChanges: boolean;
    updateWorkingCopy: (data: Partial<WorkingCopyData>) => void;
    saveWorkingCopy: (data?: Partial<WorkingCopyData>) => Promise<NodeId>;
    saveDraft: (data?: Partial<WorkingCopyData>) => Promise<NodeId>;
    discardWorkingCopy: () => Promise<void>;
    loading: boolean;
    error: Error | null;
}
/**
 * Working Copy Hook
 */
export declare function useWorkingCopy({ mode, nodeType, nodeId, parentId, treeId, workerClient, }: UseWorkingCopyOptions): UseWorkingCopyResult;
//# sourceMappingURL=useWorkingCopy.d.ts.map