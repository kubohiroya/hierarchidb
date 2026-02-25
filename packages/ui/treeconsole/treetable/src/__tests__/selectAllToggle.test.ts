import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TreeNode } from '@hierarchidb/tree-api';
import { DualKeyMap } from '@hierarchidb/util';
import { useTreeTableSelectionOverlay } from '../components/hooks/useTreeTableSelectionOverlay';
import type { TreeTableController } from '../types';
import { toNodeId, type NodeId } from '@hierarchidb/core-types';

describe('useTreeTableSelectionOverlay', () => {
  it('invokes controller to clear selections when selectAll is toggled off', () => {
    const onNodeSelect = vi.fn();
    const controller: TreeTableController = {
      onNodeSelect,
      nodeIndex: new DualKeyMap<NodeId, NodeId, TreeNode>(),
    };

    const data: TreeNode[] = ['alpha', 'beta'].map((id) => ({
      id: toNodeId(id),
      name: id,
      nodeType: 'folder',
      parentId: toNodeId('__root__'),
      depth: 0,
      createdAt: 0,
      updatedAt: 0,
      version: 1,
      metadata: {
        name: id,
        description: '',
        tags: [],
      },
      draftMetadata: {
        name: id,
        description: '',
        tags: [],
      },
      data: null,
      draftData: undefined,
      visible: true,
    }));

    const initialRowSelection: Record<string, boolean> = {
      alpha: true,
      beta: true,
    };

    const { rerender } = renderHook(
      ({ selectAll, rowSelection }) =>
        useTreeTableSelectionOverlay({
          data,
          rowSelection,
          selectAll,
          selectAllHydrated: true,
          setSelectAll: vi.fn(),
          controller,
          visibleData: data,
          getDescendants: () => new Set(),
        }),
      {
        initialProps: {
          selectAll: true,
          rowSelection: initialRowSelection,
        },
      },
    );

    onNodeSelect.mockClear();

    rerender({
      selectAll: false,
      rowSelection: initialRowSelection,
      setSelectAll: vi.fn(),
      selectAllHydrated: true,
      controller,
      visibleData: data,
      getDescendants: () => new Set(),
    });

    expect(onNodeSelect).toHaveBeenCalledWith(['alpha', 'beta'], false);
  });
});
