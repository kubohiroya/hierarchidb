/**
 * @file useTreeViewController.selection.test.tsx
 * @description TDD tests for TreeViewController selection behavior
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { TreeViewControllerProps } from './useTreeViewController.js';
import { useTreeViewController } from './useTreeViewController.js';
import { type NodeId } from '@hierarchidb/common-types';

vi.mock('comlink', () => ({
  proxy: <T,>(value: T) => value,
}));

// Mock dependencies
vi.mock('@hierarchidb/provider', () => ({
  useTreeOperations: vi.fn(() => ({
    updateNode: vi.fn(),
    moveNode: vi.fn(),
    trashNode: vi.fn(),
    duplicateNode: vi.fn(),
  })),
  useTreeState: vi.fn(() => ({
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    getNode: vi.fn(),
    getChildren: vi.fn(),
  })),
}));

describe('useTreeViewController', () => {
  let mockProps: TreeViewControllerProps;
  let mockStateManager: any;
  let mockOnStateChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnStateChange = vi.fn();
    mockStateManager = {
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      getNode: vi.fn(),
      getChildren: vi.fn(),
      updateNode: vi.fn(),
      moveNode: vi.fn(),
      trashNode: vi.fn(),
      duplicateNode: vi.fn(),
    } as any;

    mockProps = {
      treeId: 'test-console-id',
      stateManager: mockStateManager,
      onStateChange: mockOnStateChange,
    };
  });

  describe('selectNode', () => {
    it('should update selectedNodeIds when selecting a node', async () => {
      const { result } = renderHook(() => useTreeViewController(mockProps));

      expect(result.current.selectedNodeIds).toEqual([]);

      act(() => {
        result.current.selectNode('$1' as NodeId);
      });

      expect(result.current.selectedNodeIds).toEqual(['node-1'] as NodeId[]);
    });

    it('should update currentNode when selecting a node', async () => {
      const mockNode = {
        id: 'node-1',
        name: 'Test Node',
        nodeType: 'test',
        parentId: 'root',
      };

      mockStateManager.getNode = vi.fn().mockResolvedValue(mockNode);

      const { result } = renderHook(() => useTreeViewController(mockProps));

      expect(result.current.currentNode).toBeNull();

      await act(async () => {
        await result.current.selectNode('$1' as NodeId);
      });

      await waitFor(() => {
        expect(result.current.currentNode).toEqual(mockNode);
      });
    });

    it('should handle multi-select with ctrl key', async () => {
      const { result } = renderHook(() => useTreeViewController(mockProps));

      act(() => {
        result.current.selectNode('$1' as NodeId);
      });

      act(() => {
        result.current.selectNode('node-2' as NodeId, { ctrlKey: true });
      });

      expect(result.current.selectedNodeIds).toEqual(['node-1', 'node-2'] as NodeId[]);
    });

    it('should handle range select with shift key', async () => {
      const { result } = renderHook(() => useTreeViewController(mockProps));

      // Mock getChildren to return nodes for range selection
      mockStateManager.getChildren = vi
        .fn()
        .mockResolvedValue([
          { id: 'node-1' },
          { id: 'node-2' },
          { id: 'node-3' },
          { id: 'node-4' },
        ]);

      act(() => {
        result.current.selectNode('$1' as NodeId);
      });

      await act(async () => {
        await result.current.selectNode('node-3' as NodeId, { shiftKey: true });
      });

      expect(result.current.selectedNodeIds).toEqual(expect.arrayContaining(['node-1', 'node-2']) as any);
    });

    it('should notify atoms change when selection changes', async () => {
      const { result } = renderHook(() => useTreeViewController(mockProps));

      act(() => {
        result.current.selectNode('$1' as NodeId);
      });

      expect(mockOnStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedNodeIds: ['node-1'],
        }),
      );
    });
  });
});
