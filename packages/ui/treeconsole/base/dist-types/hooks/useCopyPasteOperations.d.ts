import type { NodeId, TreeNode } from '@hierarchidb/common-type';
import type { WorkerAPIAdapter } from '../adapters/index.js';
export interface CopyResult {
    success: boolean;
    copiedNodes: NodeId[];
    clipboard?: ClipboardData;
}
export interface CutResult {
    success: boolean;
    cutNodes: NodeId[];
    clipboard?: ClipboardData;
}
export interface PasteResult {
    success: boolean;
    pastedNodes: TreeNode[];
}
export interface ClipboardData {
    operation: 'copy' | 'cut';
    nodes: NodeId[];
    timestamp: number;
}
export interface UseCopyPasteOperationsOptions {
    /**
     * State manager ()
     */
    stateManager?: unknown;
    /** Worker API adapter */
    workerAdapter?: WorkerAPIAdapter;
    /** Loading state setter */
    setIsLoading?: (loading: boolean) => void;
}
export interface UseCopyPasteOperationsReturn {
    copyNodes: (nodeIds: NodeId[]) => Promise<CopyResult>;
    cutNodes: (nodeIds: NodeId[]) => Promise<CutResult>;
    pasteNodes: (targetParentId: NodeId) => Promise<PasteResult>;
    clipboardData: ClipboardData | null;
    cutNodeIds: NodeId[];
    canPaste: boolean;
    canPasteToTarget: (targetId: NodeId) => boolean;
}
export declare function useCopyPasteOperations(options?: UseCopyPasteOperationsOptions): UseCopyPasteOperationsReturn;
//# sourceMappingURL=useCopyPasteOperations.d.ts.map