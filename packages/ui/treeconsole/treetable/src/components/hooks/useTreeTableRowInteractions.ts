/**
 * useTreeTableRowInteractions
 * Encapsulates row click and double-click behaviour for TreeTable rows.
 */

import { useCallback } from 'react';
import type { MouseEvent } from 'react';
import type { TreeTableController, TreeNodeInUI } from '~/types';
import { isElementWithClosest } from '~/utils/treeTableHelpers';

interface UseTreeTableRowInteractionsParams {
  controller: TreeTableController | null;
  rowSelection: Record<string, boolean>;
  selectionMode: 'single' | 'multiple' | 'none';
  rowClickAction: 'Select/Navigate' | 'Edit';
  onRowClick?: (node: TreeNodeInUI, event: MouseEvent) => void;
  onRowDoubleClick?: (node: TreeNodeInUI, event: MouseEvent) => void;
  selectAll: boolean;
  handleStartEdit: (node: TreeNodeInUI, field?: 'name' | 'description') => void;
}

interface UseTreeTableRowInteractionsResult {
  handleRowClick: (node: TreeNodeInUI, event: MouseEvent) => void;
  handleRowDoubleClick: (node: TreeNodeInUI, event: MouseEvent) => void;
}

export function useTreeTableRowInteractions({
  controller,
  rowSelection,
  selectionMode,
  rowClickAction,
  onRowClick,
  onRowDoubleClick,
  selectAll,
  handleStartEdit,
}: UseTreeTableRowInteractionsParams): UseTreeTableRowInteractionsResult {
  const handleRowClick = useCallback((node: TreeNodeInUI, event: MouseEvent) => {
    const target = (event.target as EventTarget) || null;
    if (isElementWithClosest(target) && target.closest('a[href]')) {
      return;
    }

    if (selectAll) {
      onRowClick?.(node, event);
      return;
    }

    if (rowClickAction === 'Select/Navigate' && selectionMode !== 'none') {
      const prevSelection = { ...rowSelection };
      const nextSelection = { ...rowSelection };

      if (event.ctrlKey || event.metaKey) {
        nextSelection[node.id] = !nextSelection[node.id];
      } else {
        Object.keys(nextSelection).forEach((id) => {
          nextSelection[id] = false;
        });
        nextSelection[node.id] = true;
      }

      const prevIds = Object.keys(prevSelection).filter((id) => prevSelection[id]);
      const nextIds = Object.keys(nextSelection).filter((id) => nextSelection[id]);
      const toDeselect = prevIds.filter((id) => !nextSelection[id]);
      const toSelect = nextIds.filter((id) => !prevSelection[id]);

      if (toDeselect.length) controller?.onNodeSelect?.(toDeselect, false);
      if (toSelect.length) controller?.onNodeSelect?.(toSelect, true);
    }

    onRowClick?.(node, event);
  }, [controller, onRowClick, rowClickAction, rowSelection, selectAll, selectionMode]);

  const handleRowDoubleClick = useCallback((node: TreeNodeInUI, event: MouseEvent) => {
    const target = (event.target as EventTarget) || null;
    if (isElementWithClosest(target) && target.closest('a[href]')) {
      return;
    }

    if (rowClickAction === 'Edit') {
      handleStartEdit(node);
    }

    onRowDoubleClick?.(node, event);
  }, [handleStartEdit, onRowDoubleClick, rowClickAction]);

  return {
    handleRowClick,
    handleRowDoubleClick,
  };
}
