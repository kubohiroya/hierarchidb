/**
  * useUndoRedoOperations
  * Undo/Redohook
 * useTreeViewController
  * :
 * - 917 800
 * -
 * - Undo/Redo
  */
import type { NodeId, TreeNode } from '@hierarchidb/common-type';
import type { UndoRedoCommand, UndoRedoResult } from '../types/index.js';
export interface UseUndoRedoOperationsOptions {
    /**
     * State manager ()
     */
    stateManager?: unknown;
    /** Loading state setter */
    setIsLoading?: (loading: boolean) => void;
    /** State change callback */
    onStateChange?: (state: unknown) => void;
    /** Current state for state change notifications */
    currentState?: {
        selectedNodes: NodeId[];
        expandedNodes: NodeId[];
        currentNode: TreeNode | null;
    };
}
export interface UseUndoRedoOperationsReturn {
    undo: () => Promise<UndoRedoResult>;
    redo: () => Promise<UndoRedoResult>;
    clearHistory: () => Promise<{
        success: boolean;
        error?: string;
    }>;
    canUndo: boolean;
    canRedo: boolean;
    undoHistory: UndoRedoCommand[];
    redoHistory: UndoRedoCommand[];
}
/**
  * Undo/Redohook
  */
export declare function useUndoRedoOperations(options?: UseUndoRedoOperationsOptions): UseUndoRedoOperationsReturn;
//# sourceMappingURL=useUndoRedoOperations.d.ts.map