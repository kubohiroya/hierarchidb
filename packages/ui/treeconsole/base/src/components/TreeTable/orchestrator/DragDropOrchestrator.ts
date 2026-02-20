/**
  * DragDropOrchestrator
  * &
 * - /
 * -
 * -
  */

import { useAtom } from 'jotai';
import { useCallback, useRef } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import type { TreeViewController } from '~/types/index';
import { draggingNodeIdAtom, dropTargetNodeIdAtom, forbiddenDropTargetsAtom } from '~/components/TreeTable/state/index';
import { computeDescendants } from '@hierarchidb/ui-treeconsole-treetable';

export interface DragDropOrchestratorResult {
  // State
  draggingNodeId: NodeId | null;
  dropTargetNodeId: NodeId | null;
  isDragging: boolean;
  canDrop: (targetNodeId: NodeId) => boolean;

  // Actions
  startDrag: (nodeId: NodeId) => void;
  updateDropTarget: (targetNodeId: NodeId | null) => void;
  endDrag: () => void;
  handleDrop: (targetNodeId: NodeId) => Promise<void>;
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
  const descendantsRef = useRef<Set<NodeId>>(new Set<NodeId>());

  /**
            */
  const getDescendants = useCallback((nodeId: NodeId): Set<NodeId> => computeDescendants(tableData, nodeId), [tableData]);

  /**
            */
  const canDrop = useCallback(
    (targetNodeId: NodeId): boolean => {
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
    (nodeId: NodeId) => {
      setDraggingNodeId(nodeId);

      const descendants = getDescendants(nodeId);
      descendantsRef.current = descendants;
      setForbiddenTargets(descendants);

      //  Controller
      // Drag atoms is managed locally
      setDraggingNodeId(nodeId);
    },
    [setDraggingNodeId, setForbiddenTargets, getDescendants, controller],
  );

  /**
            */
  const updateDropTarget = useCallback(
    (targetNodeId: NodeId | null) => {
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
    setForbiddenTargets(new Set<NodeId>());
    descendantsRef.current = new Set<NodeId>();

    //  Controller
    // Clear drag atoms locally
    setDraggingNodeId(null);
  }, [setDraggingNodeId, setDropTargetNodeId, setForbiddenTargets, controller]);

  /**
            */
  const handleDrop = useCallback(
    async (targetNodeId: NodeId) => {
      if (!draggingNodeId || !canDrop(targetNodeId)) {
        endDrag();
        return;
      }

      try {
        //  Controller
        await controller?.moveNodes?.([draggingNodeId], targetNodeId);

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
