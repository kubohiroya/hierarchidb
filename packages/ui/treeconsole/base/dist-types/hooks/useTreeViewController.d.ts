/**
  * useTreeViewController
  * TreeConsolehook
 * WorkerAPIAdapterAPI
   * 1.
 * 2. WorkerAPIAdapter
 * 3.
 * 4.
  */
import { WorkerAPIAdapter } from '../adapters/index.js';
import type { SelectionMode, TreeViewController, UndoRedoCommand, UndoRedoResult } from '../types/index.js';
import type { NodeId, TreeNode } from '@hierarchidb/common-type';
import type { RowSelectionState } from '@tanstack/react-table';
import { type ClipboardData, type CopyResult, type CutResult, type PasteResult } from './useCopyPasteOperations.js';
export interface TreeViewControllerProps {
    /** TreeTypes ID */
    treeId: string;
    /** State manager */
    stateManager?: unknown;
    /** State change callback */
    onStateChange?: (state: unknown) => void;
}
export interface UseTreeViewControllerOptions {
    /**
     * ID
     */
    rootNodeId?: NodeId;
    /**
     * ID
     */
    initialExpandedNodeIds?: NodeId[];
    /**
     * WorkerAPI
     */
    workerService?: WorkerAPIAdapter | null;
    /**
     * WorkerAPIClient
     */
    workerClient?: unknown;
}
export interface UseTreeViewControllerReturn extends TreeViewController {
    currentNode: TreeNode | null;
    selectedNodes: NodeId[];
    selectedNodeIds: NodeId[];
    expandedNodes: NodeId[];
    expandedNodeIds: NodeId[];
    isLoading: boolean;
    searchText?: string;
    handleSearchTextChange?: (searchText: string) => void;
    filteredItemCount?: number;
    totalItemCount?: number;
    selectionMode: SelectionMode;
    rowSelection?: RowSelectionState;
    setSelectionMode?: (mode: SelectionMode) => void;
    data?: TreeNode[];
    expandedRowIds?: Set<NodeId>;
    selectNode: (nodeId: NodeId, options?: {
        ctrlKey?: boolean;
        shiftKey?: boolean;
    }) => Promise<void>;
    selectMultipleNodes: (nodeIds: NodeId[]) => void;
    expandNode: (nodeId: NodeId) => void;
    collapseNode: (nodeId: NodeId) => void;
    moveNode: (nodeId: NodeId, targetParentId: NodeId, index?: number) => Promise<void>;
    moveNodes: (nodeIds: NodeId[], targetParentId: NodeId) => Promise<void>;
    deleteNode: (nodeId: NodeId) => Promise<void>;
    deleteNodes: (nodeIds: NodeId[]) => Promise<void>;
    duplicateNode: (nodeId: NodeId) => Promise<void>;
    duplicateNodes: (nodeIds: NodeId[], targetParentId: NodeId) => Promise<void>;
    startEdit: (nodeId: NodeId) => Promise<void>;
    startCreate: (parentId: NodeId, name: string) => Promise<void>;
    copyNodes: (nodeIds: NodeId[]) => Promise<CopyResult>;
    cutNodes: (nodeIds: NodeId[]) => Promise<CutResult>;
    pasteNodes: (targetParentId: NodeId) => Promise<PasteResult>;
    clipboardData: ClipboardData | null;
    cutNodeIds: NodeId[];
    canPaste: boolean;
    canPasteToTarget: (targetId: NodeId) => boolean;
    undo: () => Promise<UndoRedoResult>;
    redo: () => Promise<UndoRedoResult>;
    canUndo: boolean;
    canRedo: boolean;
    undoHistory: UndoRedoCommand[];
    redoHistory: UndoRedoCommand[];
    clearHistory: () => Promise<{
        success: boolean;
        error?: string;
    }>;
}
/**
  * TreeViewController hook
    */
export declare function useTreeViewController(props?: TreeViewControllerProps & UseTreeViewControllerOptions): UseTreeViewControllerReturn;
//# sourceMappingURL=useTreeViewController.d.ts.map