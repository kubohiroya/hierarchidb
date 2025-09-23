/**
 * useTreeTableSelectionOverlay
 * Provides derived selection state for TreeTable, including select-all orchestration
 * and transitive visual selection for ancestor relationships.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { NodeId, TreeNode } from '@hierarchidb/common-type';
import type { TreeTableController } from '../../types.js';

interface UseTreeTableSelectionOverlayParams {
  data: readonly TreeNode[];
  rowSelection: Record<string, boolean>;
  selectAll: boolean;
  selectAllHydrated: boolean;
  setSelectAll: Dispatch<SetStateAction<boolean>>;
  controller: TreeTableController | null;
  visibleData: readonly TreeNode[];
  getDescendants: (nodeId: NodeId) => Set<NodeId>;
}

interface UseTreeTableSelectionOverlayResult {
  visualSelectionSet: Set<NodeId>;
  allRowsSelected: boolean;
  someSelected: boolean;
  handleSelectAll: (checked: boolean) => void;
  batchSelect: (ids: string[], checked: boolean) => void;
}

export function useTreeTableSelectionOverlay({
  data,
  rowSelection,
  selectAll,
  selectAllHydrated,
  setSelectAll,
  controller,
  visibleData,
  getDescendants,
}: UseTreeTableSelectionOverlayParams): UseTreeTableSelectionOverlayResult {
  const actualSelectionIds = useMemo(() => {
    const ids = new Set<NodeId>();
    Object.entries(rowSelection).forEach(([id, selected]) => {
      if (selected) {
        ids.add(id as NodeId);
      }
    });
    return ids;
  }, [rowSelection]);

  const visualSelectionSet = useMemo(() => {
    if (selectAll) {
      return new Set<NodeId>(data.map((node) => node.id as NodeId));
    }
    const derived = new Set<NodeId>();
    actualSelectionIds.forEach((id) => {
      derived.add(id);
      const descendants = getDescendants(id);
      descendants.forEach((descendantId) => derived.add(descendantId));
    });
    return derived;
  }, [selectAll, data, actualSelectionIds, getDescendants]);

  const allRowsSelected = useMemo(() => {
    return data.length > 0 && data.every((node) => rowSelection[node.id]);
  }, [data, rowSelection]);

  const someSelected = useMemo(() => {
    if (selectAll) return false;
    return data.some((node) => rowSelection[node.id]) && !allRowsSelected;
  }, [data, rowSelection, selectAll, allRowsSelected]);

  const selectHandlerRef = useRef(controller?.onNodeSelect ?? null);
  selectHandlerRef.current = controller?.onNodeSelect ?? null;

  const pendingSelectionRef = useRef<{ ids: string[]; checked: boolean } | null>(null);
  const rafRef = useRef<number | null>(null);

  const flushBatchedSelect = useCallback(() => {
    try {
      const payload = pendingSelectionRef.current;
      rafRef.current = null;
      if (!payload) return;
      const handler = selectHandlerRef.current;
      if (!handler) return;
      handler(payload.ids, payload.checked);
    } finally {
      pendingSelectionRef.current = null;
    }
  }, []);

  const batchSelect = useCallback((ids: string[], checked: boolean) => {
    pendingSelectionRef.current = { ids, checked };
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(flushBatchedSelect);
    }
  }, [flushBatchedSelect]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pendingSelectionRef.current = null;
    };
  }, []);

  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectAll((prev) => (prev === checked ? prev : checked));
  }, [setSelectAll]);

  const previousSelectAllRef = useRef(selectAll);
  useEffect(() => {
    const handler = selectHandlerRef.current;
    previousSelectAllRef.current = selectAll;
    if (!handler || !selectAllHydrated) {
      return;
    }

    const visibleIds = visibleData.reduce<string[]>((acc, node) => {
      if (node?.id == null) {
        return acc;
      }
      acc.push(String(node.id));
      return acc;
    }, []);

    if (selectAll) {
      const missing = visibleIds.filter((id) => !rowSelection[id]);
      if (missing.length) {
        handler(missing, true);
      }
    } else if (previousSelectAllRef.current) {
      const selectedVisible = visibleIds.filter((id) => rowSelection[id]);
      if (selectedVisible.length) {
        handler(selectedVisible, false);
      }
    }

    previousSelectAllRef.current = selectAll;
  }, [selectAll, selectAllHydrated, visibleData, rowSelection]);

  return {
    visualSelectionSet,
    allRowsSelected,
    someSelected,
    handleSelectAll,
    batchSelect,
  };
}
