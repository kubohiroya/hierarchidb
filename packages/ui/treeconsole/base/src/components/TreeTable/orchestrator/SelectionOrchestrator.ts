/**
 * SelectionOrchestrator
 * -
 * -
 * - /
 * -
 */

import type { NodeId } from '@hierarchidb/core-types';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback } from 'react';
import {
  clearSelectionAtom,
  rowSelectionAtom,
  selectAllAtom,
  selectedNodeIdsAtom,
  selectionModeAtom,
} from '~/components/TreeTable/state/index';
import type { TreeViewController } from '~/types/index';

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

  const selectNode = useCallback(
    (nodeId: string) => {
      if (selectionMode === 'none') return;

      if (selectionMode === 'single') {
        //  :
        setRowSelection({ [nodeId]: true });
      } else {
        //  :
        setRowSelection({ [nodeId]: true });
      }

      //  Controller
      controller?.selectNode?.(nodeId as NodeId);
    },
    [selectionMode, setRowSelection, controller]
  );

  const selectMultipleNodes = useCallback(
    (nodeIds: string[]) => {
      if (selectionMode === 'none') return;

      const newSelection: Record<string, boolean> = {};
      nodeIds.forEach((id) => {
        newSelection[id] = true;
      });

      setRowSelection(newSelection);

      //  Controller
      controller?.selectMultipleNodes?.(nodeIds as NodeId[]);
    },
    [selectionMode, setRowSelection, controller]
  );

  //  Ctrl+
  const toggleSelection = useCallback(
    (nodeId: string) => {
      if (selectionMode === 'none') return;

      if (selectionMode === 'single') {
        setRowSelection({ [nodeId]: true });
      } else {
        setRowSelection((prev) => ({
          ...prev,
          [nodeId]: !prev[nodeId],
        }));
      }

      //  Controller
      controller?.selectNode?.(nodeId as NodeId);
    },
    [selectionMode, setRowSelection, controller]
  );

  const handleClearSelection = useCallback(() => {
    clearSelection();
  }, [clearSelection, controller]);

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
