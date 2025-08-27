/**
 * useUndoRedoOperations
 *
 * Undo/Redo操作を専門に扱う分離されたhook。
 * useTreeViewControllerから抽出してモジュラー化。
 *
 * 【リファクタリング目的】:
 * - ファイルサイズ最適化（917行 → 800行以下）
 * - 関心の分離によるメンテナンス性向上
 * - Undo/Redo機能の独立性確保
 */

import { useCallback, useMemo } from 'react';
import type { NodeId, TreeNode } from '@hierarchidb/common-core';
// Use types from main types file to avoid conflicts
import type { UndoRedoResult, UndoRedoCommand } from '../types/index';

// 【型定義】: Undo/Redo操作の結果型 🟢
export interface UseUndoRedoOperationsOptions {
  /** State manager (テスト用) */
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
  // Undo/Redo操作
  undo: () => Promise<UndoRedoResult>;
  redo: () => Promise<UndoRedoResult>;
  clearHistory: () => Promise<{ success: boolean; error?: string }>;
  
  // Undo/Redo状態
  canUndo: boolean;
  canRedo: boolean;
  undoHistory: UndoRedoCommand[];
  redoHistory: UndoRedoCommand[];
}

/**
 * Undo/Redo操作を管理するカスタムhook
 */
export function useUndoRedoOperations(
  options: UseUndoRedoOperationsOptions = {}
): UseUndoRedoOperationsReturn {
  const { stateManager, setIsLoading, onStateChange, currentState } = options;

  // ================================================================
  // Undo/Redo 操作 - TDD Red Phase用プレースホルダー実装
  // 現在は未実装なので、これらのテストは失敗するはずです
  // ================================================================

  // Undo/Redoの状態管理（プレースホルダー）
  const canUndo = useMemo(() => {
    if ((stateManager as any)?.canUndo) {
      return (stateManager as any).canUndo();
    }
    return false; // 未実装のため常にfalse
  }, [stateManager]);

  const canRedo = useMemo(() => {
    if ((stateManager as any)?.canRedo) {
      return (stateManager as any).canRedo();
    }
    return false; // 未実装のため常にfalse
  }, [stateManager]);

  const undoHistory = useMemo(() => {
    if ((stateManager as any)?.getUndoHistory) {
      return (stateManager as any).getUndoHistory();
    }
    return []; // 未実装のため空配列
  }, [stateManager]);

  const redoHistory = useMemo(() => {
    if ((stateManager as any)?.getRedoHistory) {
      return (stateManager as any).getRedoHistory();
    }
    return []; // 未実装のため空配列
  }, [stateManager]);

  // Undo操作の実装（プレースホルダー）
  const undo = useCallback(async (): Promise<UndoRedoResult> => {
    if ((stateManager as any)?.undo) {
      setIsLoading?.(true);
      try {
        const result = await (stateManager as any).undo();
        
        // 成功時の状態変更通知
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
          error: error instanceof Error ? error.message : 'Unknown error during undo'
        };
      } finally {
        setIsLoading?.(false);
      }
    }
    
    // 未実装の場合は失敗レスポンスを返す（エラーを投げない）
    return {
      success: false,
      error: 'Undo functionality not yet connected to CommandProcessor'
    };
  }, [stateManager, setIsLoading, onStateChange, currentState]);

  // Redo操作の実装（プレースホルダー）
  const redo = useCallback(async (): Promise<UndoRedoResult> => {
    if ((stateManager as any)?.redo) {
      setIsLoading?.(true);
      try {
        const result = await (stateManager as any).redo();
        
        // 成功時の状態変更通知
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
          error: error instanceof Error ? error.message : 'Unknown error during redo'
        };
      } finally {
        setIsLoading?.(false);
      }
    }
    
    // 未実装の場合は失敗レスポンスを返す（エラーを投げない）
    return {
      success: false,
      error: 'Redo functionality not yet connected to CommandProcessor'
    };
  }, [stateManager, setIsLoading, onStateChange, currentState]);

  // 履歴クリア操作の実装（プレースホルダー）
  const clearHistory = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if ((stateManager as any)?.clearHistory) {
      setIsLoading?.(true);
      try {
        return await (stateManager as any).clearHistory();
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error during clear history'
        };
      } finally {
        setIsLoading?.(false);
      }
    }
    
    // 未実装の場合はエラーを返す
    return {
      success: false,
      error: 'Clear history functionality not implemented yet'
    };
  }, [stateManager, setIsLoading]);

  return {
    // Undo/Redo操作
    undo,
    redo,
    clearHistory,
    
    // Undo/Redo状態
    canUndo,
    canRedo,
    undoHistory,
    redoHistory,
  };
}