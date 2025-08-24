/**
 * TreeTableOrchestrator (Simplified)
 *
 * TreeTableの状態管理とアクションを統合する
 * 簡化されたオーケストレーター
 */

import { useMemo } from 'react';
import type { TreeTableController, TreeTableOrchestratorResult } from '../types';

/**
 * TreeTableOrchestrator Hook
 *
 * TreeTableの基本的な状態管理を提供
 */
export function useTreeTableOrchestrator(
  controller: TreeTableController | null
): TreeTableOrchestratorResult {
  // Selection operations
  const selection = useMemo(() => {
    const selectedRowIds = new Set(
      Object.keys(controller?.rowSelection || {}).filter((id) => controller?.rowSelection?.[id])
    );

    return {
      selectedRowIds,
      isSelected: (id: string) => selectedRowIds.has(id),
      toggleSelection: (id: string, isMulti = false) => {
        if (!controller?.onNodeSelect) return;

        if (isMulti) {
          const newIds = selectedRowIds.has(id)
            ? Array.from(selectedRowIds).filter((existingId) => existingId !== id)
            : [...Array.from(selectedRowIds), id];
          controller.onNodeSelect(newIds, true);
        } else {
          controller.onNodeSelect([id], true);
        }
      },
      clearSelection: () => {
        controller?.onNodeSelect?.([], false);
      },
    };
  }, [controller?.rowSelection, controller?.onNodeSelect]);

  // Expansion operations
  const expansion = useMemo(() => {
    const expandedRowIds = controller?.expandedRowIds || new Set();

    return {
      expandedRowIds,
      isExpanded: (id: string) => expandedRowIds.has(id),
      toggleExpansion: (id: string) => {
        const isCurrentlyExpanded = expandedRowIds.has(id);
        controller?.onNodeExpand?.(id, !isCurrentlyExpanded);
      },
      expandAll: () => {
        // TODO: Implement expand all functionality
        console.log('Expand all nodes');
      },
      collapseAll: () => {
        // TODO: Implement collapse all functionality
        console.log('Collapse all nodes');
      },
    };
  }, [controller?.expandedRowIds, controller?.onNodeExpand]);

  // Editing operations
  const editing = useMemo(
    () => ({
      editingNodeId: null, // TODO: Add editing state
      startEdit: (id: string) => {
        controller?.startEdit?.(id);
      },
      finishEdit: (newValue: string) => {
        // TODO: Get current editing node ID from state
        controller?.finishEdit?.('', newValue);
      },
      cancelEdit: () => {
        controller?.cancelEdit?.();
      },
    }),
    [controller?.startEdit, controller?.cancelEdit]
  );

  // Search operations
  const search = useMemo(
    () => ({
      searchText: controller?.searchText || '',
      setSearchText: (text: string) => {
        controller?.handleSearchTextChange?.(text);
      },
      searchResults: new Set<string>(), // TODO: Implement search results
      clearSearch: () => {
        controller?.handleSearchTextChange?.('');
      },
    }),
    [controller?.searchText, controller?.handleSearchTextChange]
  );

  // Drag & Drop operations
  const dragDrop = useMemo(
    () => ({
      draggingNodeId: null,
      dropTargetId: null,
      dropPosition: null as 'before' | 'after' | 'into' | null,
      handleDragStart: (id: string) => {
        console.log('Drag start:', id);
        // TODO: Implement drag start
      },
      handleDragEnd: () => {
        console.log('Drag end');
        // TODO: Implement drag end
      },
      handleDrop: (targetId: string, position: 'before' | 'after' | 'into') => {
        console.log('Drop:', targetId, position);
        // TODO: Implement drop
      },
    }),
    []
  );

  return {
    selection,
    expansion,
    editing,
    search,
    dragDrop,
  };
}

export type { TreeTableOrchestratorResult };
