/**
 * DragDropOrchestrator
 *
 * ドラッグ&ドロップに関するユーザーストーリーの管理
 * - ドラッグ開始/終了
 * - ドロップ可能判定
 * - 循環参照防止
 */

import { useAtom } from 'jotai';
import { useCallback, useRef } from 'react';
import type { NodeId } from '@hierarchidb/common-core';
import type { TreeViewController } from '../../../types/index';
import type { TreeNode } from '@hierarchidb/common-core';
import { draggingNodeIdAtom, dropTargetNodeIdAtom, forbiddenDropTargetsAtom } from '../state';

export interface DragDropOrchestratorResult {
  // State
  draggingNodeId: string | null;
  dropTargetNodeId: string | null;
  isDragging: boolean;
  canDrop: (targetNodeId: string) => boolean;

  // Actions
  startDrag: (nodeId: string) => void;
  updateDropTarget: (targetNodeId: string | null) => void;
  endDrag: () => void;
  handleDrop: (targetNodeId: string) => Promise<void>;
}

/**
 * ドラッグ&ドロップ操作のオーケストレーター
 */
export function useDragDropOrchestrator(
  controller: TreeViewController | null,
  tableData: TreeNode[]
): DragDropOrchestratorResult {
  // State atoms
  const [draggingNodeId, setDraggingNodeId] = useAtom(draggingNodeIdAtom);
  const [dropTargetNodeId, setDropTargetNodeId] = useAtom(dropTargetNodeIdAtom);
  const [forbiddenTargets, setForbiddenTargets] = useAtom(forbiddenDropTargetsAtom);

  // Refs for performance
  const descendantsRef = useRef<Set<string>>(new Set());

  /**
   * ノードの全子孫を取得
   */
  const getDescendants = useCallback(
    (nodeId: string): Set<string> => {
      const descendants = new Set<string>();
      const stack = [nodeId];

      while (stack.length > 0) {
        const currentId = stack.pop()!;
        descendants.add(currentId);

        // 子ノードを追加
        const children = tableData.filter((n) => n.parentId === currentId);
        children.forEach((child) => {
          if (child.id && !descendants.has(child.id)) {
            stack.push(child.id);
          }
        });
      }

      return descendants;
    },
    [tableData]
  );

  /**
   * ドロップ可能かチェック
   */
  const canDrop = useCallback(
    (targetNodeId: string): boolean => {
      if (!draggingNodeId) return false;

      // 自分自身へのドロップは禁止
      if (targetNodeId === draggingNodeId) return false;

      // 子孫へのドロップは禁止（循環参照防止）
      if (forbiddenTargets.has(targetNodeId)) return false;

      // 現在の親へのドロップは禁止（移動の意味がない）
      const draggingNode = tableData.find((n) => n.id === draggingNodeId);
      if (draggingNode?.parentId === targetNodeId) return false;

      return true;
    },
    [draggingNodeId, forbiddenTargets, tableData]
  );

  /**
   * ドラッグ開始
   */
  const startDrag = useCallback(
    (nodeId: string) => {
      setDraggingNodeId(nodeId);

      // 子孫ノードを禁止ターゲットに設定
      const descendants = getDescendants(nodeId);
      descendantsRef.current = descendants;
      setForbiddenTargets(descendants);

      // Controllerに通知
      // Drag state is managed locally
      setDraggingNodeId(nodeId);
    },
    [setDraggingNodeId, setForbiddenTargets, getDescendants, controller]
  );

  /**
   * ドロップターゲット更新
   */
  const updateDropTarget = useCallback(
    (targetNodeId: string | null) => {
      if (targetNodeId && !canDrop(targetNodeId)) {
        setDropTargetNodeId(null);
        return;
      }

      setDropTargetNodeId(targetNodeId);
    },
    [canDrop, setDropTargetNodeId]
  );

  /**
   * ドラッグ終了
   */
  const endDrag = useCallback(() => {
    setDraggingNodeId(null);
    setDropTargetNodeId(null);
    setForbiddenTargets(new Set());
    descendantsRef.current = new Set();

    // Controllerに通知
    // Clear drag state locally
    setDraggingNodeId(null);
  }, [setDraggingNodeId, setDropTargetNodeId, setForbiddenTargets, controller]);

  /**
   * ドロップ処理
   */
  const handleDrop = useCallback(
    async (targetNodeId: string) => {
      if (!draggingNodeId || !canDrop(targetNodeId)) {
        endDrag();
        return;
      }

      try {
        // Controllerを通じて移動を実行
        await controller?.moveNodes?.([draggingNodeId as NodeId], targetNodeId as NodeId);

        // 成功したらクリア
        endDrag();
      } catch (error) {
        console.error('Failed to move node:', error);
        endDrag();
      }
    },
    [draggingNodeId, canDrop, endDrag, controller]
  );

  return {
    // State
    draggingNodeId,
    dropTargetNodeId,
    isDragging: draggingNodeId !== null,
    canDrop,

    // Actions
    startDrag,
    updateDropTarget,
    endDrag,
    handleDrop,
  };
}
