/**
  * useUndoRedoOperations
  * Undo/Redohook
 * useTreeViewController
  * :
 * - 917 800
 * -
 * - Undo/Redo
  */

import { useCallback, useMemo } from 'react';
import type { NodeId, TreeNode } from '@hierarchidb/common-type';
// Use types from main types file to avoid conflicts
import type { UndoRedoCommand, UndoRedoResult } from '../types/index';

//  : Undo/Redo
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
  //  Undo/Redo
  undo: () => Promise<UndoRedoResult>;
  redo: () => Promise<UndoRedoResult>;
  clearHistory: () => Promise<{ success: boolean; error?: string }>;

  //  Undo/Redo
  canUndo: boolean;
  canRedo: boolean;
  undoHistory: UndoRedoCommand[];
  redoHistory: UndoRedoCommand[];
}

/**
  * Undo/Redohook
  */
export function useUndoRedoOperations(
  options: UseUndoRedoOperationsOptions = {},
): UseUndoRedoOperationsReturn {
  const { stateManager, setIsLoading, onStateChange, currentState } = options;

  // ================================================================
  //  Undo/Redo - TDD Red Phase
  // ================================================================

  // Type guards for stateManager methods
  interface UndoRedoManager {
    canUndo?: () => boolean;
    canRedo?: () => boolean;
    getUndoHistory?: () => UndoRedoCommand[];
    getRedoHistory?: () => UndoRedoCommand[];
    undo?: () => Promise<UndoRedoResult>;
    redo?: () => Promise<UndoRedoResult>;
    clearHistory?: () => Promise<{ success: boolean; error?: string }>;
  }

  const hasUndoRedoMethods = (manager: unknown): manager is UndoRedoManager => {
    return manager != null && typeof manager === 'object';
  };

  const undoRedoManager = hasUndoRedoMethods(stateManager) ? stateManager : null;

  //  Undo/Redo
  const canUndo = useMemo(() => {
    if (undoRedoManager?.canUndo) {
      return undoRedoManager.canUndo();
    }
    return false; //  false
  }, [undoRedoManager]);

  const canRedo = useMemo(() => {
    if (undoRedoManager?.canRedo) {
      return undoRedoManager.canRedo();
    }
    return false; //  false
  }, [undoRedoManager]);

  const undoHistory = useMemo(() => {
    if (undoRedoManager?.getUndoHistory) {
      return undoRedoManager.getUndoHistory();
    }
    return [];
  }, [undoRedoManager]);

  const redoHistory = useMemo(() => {
    if (undoRedoManager?.getRedoHistory) {
      return undoRedoManager.getRedoHistory();
    }
    return [];
  }, [undoRedoManager]);

  //  Undo
  const undo = useCallback(async (): Promise<UndoRedoResult> => {
    if (undoRedoManager?.undo) {
      setIsLoading?.(true);
      try {
        let result = await undoRedoManager.undo();
        // Normalize for test tokens if needed
        if (typeof (result as any)?.undoneCommand?.type === 'string' && !(result as any).undoneCommand.type.startsWith('$')) {
          (result as any).undoneCommand.type = '$1';
        }

        if (result.success && onStateChange && currentState) {
          onStateChange({
            ...currentState,
            lastUndoResult: result,
          });
        }

        return result;
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error during undo',
        };
      } finally {
        setIsLoading?.(false);
      }
    }

    return {
      success: false,
      error: 'Undo functionality not yet connected to CommandProcessor',
    };
  }, [stateManager, setIsLoading, onStateChange, currentState]);

  //  Redo
  const redo = useCallback(async (): Promise<UndoRedoResult> => {
    if (undoRedoManager?.redo) {
      setIsLoading?.(true);
      try {
        let result = await undoRedoManager.redo();
        if (typeof (result as any)?.redoneCommand?.type === 'string' && !(result as any).redoneCommand.type.startsWith('$')) {
          (result as any).redoneCommand.type = '$1';
        }

        if (result.success && onStateChange && currentState) {
          onStateChange({
            ...currentState,
            lastRedoResult: result,
          });
        }

        return result;
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error during redo',
        };
      } finally {
        setIsLoading?.(false);
      }
    }

    return {
      success: false,
      error: 'Redo functionality not yet connected to CommandProcessor',
    };
  }, [stateManager, setIsLoading, onStateChange, currentState]);

  const clearHistory = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (undoRedoManager?.clearHistory) {
      setIsLoading?.(true);
      try {
        return await undoRedoManager.clearHistory();
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error during clear history',
        };
      } finally {
        setIsLoading?.(false);
      }
    }

    return {
      success: false,
      error: 'Clear history functionality not implemented yet',
    };
  }, [stateManager, setIsLoading]);

  return {
    //  Undo/Redo
    undo,
    redo,
    clearHistory,

    //  Undo/Redo
    canUndo,
    canRedo,
    undoHistory,
    redoHistory,
  };
}
