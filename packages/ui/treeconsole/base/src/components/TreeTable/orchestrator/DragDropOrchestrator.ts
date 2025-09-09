/**
  * DragDropOrchestrator
  * &
 * - /
 * -
 * -
  */

import { useAtom } from 'jotai';
import { useCallback, useRef } from 'react';
import type { NodeId, TreeNode } from '@hierarchidb/common-type';
import type { TreeViewController } from '../../../types/index';
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
  * &
  */
export function useDragDropOrchestrator(
  controller: TreeViewController | null,
  tableData: TreeNode[],
): DragDropOrchestratorResult {
  // State atoms
  const [draggingNodeId, setDraggingNodeId] = useAtom(draggingNodeIdAtom);
  const [dropTargetNodeId, setDropTargetNodeId] = useAtom(dropTargetNodeIdAtom);
  const [forbiddenTargets, setForbiddenTargets] = useAtom(forbiddenDropTargetsAtom);

  // Refs for performance
  const descendantsRef = useRef<Set<string>>(new Set());

  /**
            */
  const getDescendants = useCallback(
    (nodeId: string): Set<string> => {
      const descendants = new Set<string>();
      const stack = [nodeId];

      while (stack.length > 0) {
        const currentId = stack.pop()!;
        descendants.add(currentId);

        const children = tableData.filter((n) => n.parentId === currentId);
        children.forEach((child) => {
          if (child.id && !descendants.has(child.id)) {
            stack.push(child.id);
          }
        });
      }

      return descendants;
    },
    [tableData],
  );

  /**
            */
  const canDrop = useCallback(
    (targetNodeId: string): boolean => {
      if (!draggingNodeId) return false;

      if (targetNodeId === draggingNodeId) return false;

      if (forbiddenTargets.has(targetNodeId)) return false;

      const draggingNode = tableData.find((n) => n.id === draggingNodeId);
      if (draggingNode?.parentId === targetNodeId) return false;

      return true;
    },
    [draggingNodeId, forbiddenTargets, tableData],
  );

  /**
            */
  const startDrag = useCallback(
    (nodeId: string) => {
      setDraggingNodeId(nodeId);

      const descendants = getDescendants(nodeId);
      descendantsRef.current = descendants;
      setForbiddenTargets(descendants);

      //  Controller
      // Drag state is managed locally
      setDraggingNodeId(nodeId);
    },
    [setDraggingNodeId, setForbiddenTargets, getDescendants, controller],
  );

  /**
            */
  const updateDropTarget = useCallback(
    (targetNodeId: string | null) => {
      if (targetNodeId && !canDrop(targetNodeId)) {
        setDropTargetNodeId(null);
        return;
      }

      setDropTargetNodeId(targetNodeId);
    },
    [canDrop, setDropTargetNodeId],
  );

  /**
            */
  const endDrag = useCallback(() => {
    setDraggingNodeId(null);
    setDropTargetNodeId(null);
    setForbiddenTargets(new Set());
    descendantsRef.current = new Set();

    //  Controller
    // Clear drag state locally
    setDraggingNodeId(null);
  }, [setDraggingNodeId, setDropTargetNodeId, setForbiddenTargets, controller]);

  /**
            */
  const handleDrop = useCallback(
    async (targetNodeId: string) => {
      if (!draggingNodeId || !canDrop(targetNodeId)) {
        endDrag();
        return;
      }

      try {
        //  Controller
        await controller?.moveNodes?.([draggingNodeId as NodeId], targetNodeId as NodeId);

        endDrag();
      } catch (error) {
        console.error('Failed to move node:', error);
        endDrag();
      }
    },
    [draggingNodeId, canDrop, endDrag, controller],
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
