/**
 * SelectionOrchestrator
 *
 * ノード選択に関するユーザーストーリーの管理
 * - 単一選択
 * - 複数選択
 * - 全選択/解除
 * - 選択モード切替
 */

import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import type { NodeId } from '@hierarchidb/common-core';
import { useCallback } from 'react';
import type { TreeViewController } from '../../../types/index';
import {
  rowSelectionAtom,
  selectionModeAtom,
  selectedNodeIdsAtom,
  clearSelectionAtom,
  selectAllAtom,
} from '../state';

export interface SelectionOrchestratorResult {
  // State
  selectedNodeIds: string[];
  selectionMode: 'none' | 'single' | 'multiple';

  // Actions
  selectNode: (nodeId: string) => void;
  selectMultipleNodes: (nodeIds: string[]) => void;
  clearSelection: () => void;
  selectAll: () => void;
  toggleSelection: (nodeId: string) => void;
}

/**
 * 選択操作のオーケストレーター
 */
export function useSelectionOrchestrator(
  controller: TreeViewController | null
): SelectionOrchestratorResult {
  // State atoms
  const [_rowSelection, setRowSelection] = useAtom(rowSelectionAtom);
  const [selectionMode] = useAtom(selectionModeAtom);
  const selectedNodeIds = useAtomValue(selectedNodeIdsAtom);

  // Action atoms
  const clearSelection = useSetAtom(clearSelectionAtom);
  const selectAll = useSetAtom(selectAllAtom);

  // 単一ノード選択
  const selectNode = useCallback(
    (nodeId: string) => {
      if (selectionMode === 'none') return;

      if (selectionMode === 'single') {
        // シングル選択: 他をクリアして選択
        setRowSelection({ [nodeId]: true });
      } else {
        // マルチ選択: 現在の選択をクリアして新規選択
        setRowSelection({ [nodeId]: true });
      }

      // Controllerに通知
      controller?.selectNode?.(nodeId as NodeId);
    },
    [selectionMode, setRowSelection, controller]
  );

  // 複数ノード選択
  const selectMultipleNodes = useCallback(
    (nodeIds: string[]) => {
      if (selectionMode === 'none') return;

      const newSelection: Record<string, boolean> = {};
      nodeIds.forEach((id) => {
        newSelection[id] = true;
      });

      setRowSelection(newSelection);

      // Controllerに通知
      controller?.selectMultipleNodes?.(nodeIds as NodeId[]);
    },
    [selectionMode, setRowSelection, controller]
  );

  // 選択トグル（Ctrl+クリック用）
  const toggleSelection = useCallback(
    (nodeId: string) => {
      if (selectionMode === 'none') return;

      if (selectionMode === 'single') {
        // シングル選択では常に置き換え
        setRowSelection({ [nodeId]: true });
      } else {
        // マルチ選択ではトグル
        setRowSelection((prev) => ({
          ...prev,
          [nodeId]: !prev[nodeId],
        }));
      }

      // Controllerに通知
      controller?.selectNode?.(nodeId as NodeId);
    },
    [selectionMode, setRowSelection, controller]
  );

  // 選択クリア
  const handleClearSelection = useCallback(() => {
    clearSelection();
  }, [clearSelection, controller]);

  // 全選択
  const handleSelectAll = useCallback(() => {
    if (selectionMode === 'none') return;
    selectAll();
  }, [selectionMode, selectAll, controller]);

  return {
    // State
    selectedNodeIds,
    selectionMode,

    // Actions
    selectNode,
    selectMultipleNodes,
    clearSelection: handleClearSelection,
    selectAll: handleSelectAll,
    toggleSelection,
  };
}
