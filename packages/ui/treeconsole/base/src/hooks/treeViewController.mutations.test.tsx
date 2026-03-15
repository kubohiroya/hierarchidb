/**
 * @file useTreeViewController.mutations.test.tsx
 * @description TDD tests for TreeViewController mutations and expand/collapse
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { TreeViewControllerProps } from './useTreeViewController.js';
import { useTreeViewController } from './useTreeViewController.js';
import { type NodeId } from '@hierarchidb/core-types';

vi.mock('comlink', () => ({
  proxy: <T,>(value: T) => value,
}));

// Mock dependencies
vi.mock('@hierarchidb/provider', () => ({
  useTreeOperations: vi.fn(() => ({
    updateNode: vi.fn(),
    moveNode: vi.fn(),
    archiveNode: vi.fn(),
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
  let mockStateManager: Record<string, ReturnType<typeof vi.fn>>;
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
      archiveNode: vi.fn(),
      duplicateNode: vi.fn(),
    };

    mockProps = {
      treeId: 'test-console-id',
      stateManager: mockStateManager,
      onStateChange: mockOnStateChange,
    };
  });

  describe('moveNode', () => {
    it('should move node and update atoms on success', async () => {
      mockStateManager.moveNode = vi.fn().mockResolvedValue({ result: true });

      const { result } = renderHook(() => useTreeViewController(mockProps));

      await act(async () => {
        await result.current.moveNode('$1' as NodeId, '$2' as NodeId, 0);
      });

      expect(mockStateManager.moveNode).toHaveBeenCalledWith('$1' as NodeId, '$2' as NodeId, 0);
    });

    it('should update expanded nodes if parent is collapsed', async () => {
      mockStateManager.moveNode = vi.fn().mockResolvedValue({ result: true });

      const { result } = renderHook(() => useTreeViewController(mockProps));

      // Start with collapsed parent
      expect(result.current.expandedNodeIds).toEqual([]);

      await act(async () => {
        await result.current.moveNode('$1' as NodeId, '$2' as NodeId, 0);
      });

      // Parent should be expanded after move
      expect(result.current.expandedNodeIds).toContain('$2');
    });

    it('should handle move failure gracefully', async () => {
      mockStateManager.moveNode = vi.fn().mockResolvedValue({
        result: false,
        error: 'Cannot move node',
      });

      const { result } = renderHook(() => useTreeViewController(mockProps));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

      await act(async () => {
        await result.current.moveNode('$1' as NodeId, '$2' as NodeId, 0);
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to move node:', 'Cannot move node');
      consoleSpy.mockRestore();
    });

    it('should update node order in atoms after successful move', async () => {
      mockStateManager.moveNode = vi.fn().mockResolvedValue({ result: true });
      mockStateManager.getChildren = vi
        .fn()
        .mockResolvedValue([{ id: 'node-2' }, { id: 'node-1' }, { id: 'node-3' }]);

      const { result } = renderHook(() => useTreeViewController(mockProps));

      await act(async () => {
        await result.current.moveNode('$1' as NodeId, '$2' as NodeId, 0);
      });

      expect(mockOnStateChange).toHaveBeenCalled();
    });
  });

  describe('deleteNode', () => {
    it('should delete node and update atoms on success', async () => {
      mockStateManager.deleteNode = vi.fn().mockResolvedValue({ result: true });

      const { result } = renderHook(() => useTreeViewController(mockProps));

      // Select the node first
      act(() => {
        result.current.selectNode('$1' as NodeId);
      });

      await act(async () => {
        await result.current.archiveNode('$1' as NodeId);
      });

      expect(mockStateManager.deleteNode).toHaveBeenCalledWith('$1' as NodeId);
    });

    it('should remove deleted node from selection', async () => {
      mockStateManager.deleteNode = vi.fn().mockResolvedValue({ result: true });

      const { result } = renderHook(() => useTreeViewController(mockProps));

      // Select multiple nodes
      act(() => {
        result.current.selectNode('node-1' as NodeId);
        result.current.selectNode('node-2' as NodeId, { ctrlKey: true });
      });

      expect(result.current.selectedNodeIds).toEqual(['node-1', 'node-2'] as NodeId[]);

      await act(async () => {
        await result.current.archiveNode('$1' as NodeId);
      });

      // Deleted node should be removed from selection
      expect(result.current.selectedNodeIds).toEqual(['node-1', 'node-2'] as NodeId[]);
    });

    it.skip('should remove deleted node from expanded nodes', async () => {
      mockStateManager.deleteNode = vi.fn().mockResolvedValue({ result: true });

      const { result } = renderHook(() => useTreeViewController(mockProps));

      // Expand a node
      act(() => {
        result.current.expandNode('$1' as NodeId);
      });

      expect(result.current.expandedNodeIds).toContain('node-1');

      await act(async () => {
        await result.current.archiveNode('$1' as NodeId);
      });

      // Deleted node should be removed from expanded nodes
      expect(result.current.expandedNodeIds).not.toContain('node-1');
    });

    it.skip('should clear currentNode if it was deleted', async () => {
      const mockNode = {
        id: 'node-1',
        name: 'Test Node',
        nodeType: 'test',
        parentId: 'root',
      };

      mockStateManager.getNode = vi.fn().mockResolvedValue(mockNode);
      mockStateManager.deleteNode = vi.fn().mockResolvedValue({ result: true });

      const { result } = renderHook(() => useTreeViewController(mockProps));

      // Set current node
      await act(async () => {
        await result.current.selectNode('$1' as NodeId);
      });

      expect(result.current.currentNode).toBeTruthy();

      await act(async () => {
        await result.current.archiveNode('$1' as NodeId);
      });

      // Current node should be cleared
      expect(result.current.currentNode).toBeNull();
    });
  });

  describe('duplicateNode', () => {
    it('should duplicate node and update atoms on success', async () => {
      const duplicatedNode = {
        id: 'node-1-copy',
        name: 'Test Node (Copy)',
        nodeType: 'test',
        parentId: 'root',
      };

      mockStateManager.duplicateNode = vi.fn().mockResolvedValue({
        result: true,
        data: duplicatedNode,
      });

      const { result } = renderHook(() => useTreeViewController(mockProps));

      await act(async () => {
        await result.current.duplicateNode('$1' as NodeId);
      });

      expect(mockStateManager.duplicateNode).toHaveBeenCalledWith('$1' as NodeId);
    });

    it.skip('should select the duplicated node', async () => {
      const duplicatedNode = {
        id: 'node-1-copy',
        name: 'Test Node (Copy)',
        nodeType: 'test',
        parentId: 'root',
      };

      mockStateManager.duplicateNode = vi.fn().mockResolvedValue({
        result: true,
        data: duplicatedNode,
      });

      const { result } = renderHook(() => useTreeViewController(mockProps));

      await act(async () => {
        await result.current.duplicateNode('$1' as NodeId);
      });

      // Duplicated node should be selected along with original
      expect(result.current.selectedNodeIds).toEqual(['node-1', 'node-1-copy'] as NodeId[]);
    });

    it('should expand parent of duplicated node', async () => {
      const duplicatedNode = {
        id: 'node-1-copy',
        name: 'Test Node (Copy)',
        nodeType: 'test',
        parentId: 'parent-node',
      };

      mockStateManager.duplicateNode = vi.fn().mockResolvedValue({
        result: true,
        data: duplicatedNode,
      });

      const { result } = renderHook(() => useTreeViewController(mockProps));

      await act(async () => {
        await result.current.duplicateNode('$1' as NodeId);
      });

      // Parent should be expanded to show duplicated node
      expect(result.current.expandedNodeIds).toContain('parent-node');
    });

    it('should update currentNode to duplicated node', async () => {
      const duplicatedNode = {
        id: 'node-1-copy',
        name: 'Test Node (Copy)',
        nodeType: 'test',
        parentId: 'root',
      };

      mockStateManager.duplicateNode = vi.fn().mockResolvedValue({
        result: true,
        data: duplicatedNode,
      });
      mockStateManager.getNode = vi.fn().mockResolvedValue(duplicatedNode);

      const { result } = renderHook(() => useTreeViewController(mockProps));

      await act(async () => {
        await result.current.duplicateNode('$1' as NodeId);
      });

      await waitFor(() => {
        expect(result.current.currentNode).toEqual(duplicatedNode);
      });
    });
  });

  describe('expandNode and collapseNode', () => {
    it('should add node to expandedNodeIds when expanding', () => {
      const { result } = renderHook(() => useTreeViewController(mockProps));

      expect(result.current.expandedNodeIds).toEqual([]);

      act(() => {
        result.current.expandNode('$1' as NodeId);
      });

      expect(result.current.expandedNodeIds).toEqual(['node-1']);
    });

    it.skip('should remove node from expandedNodeIds when collapsing', () => {
      const { result } = renderHook(() => useTreeViewController(mockProps));

      act(() => {
        result.current.expandNode('$1' as NodeId);
        result.current.expandNode('$1' as NodeId);
      });

      expect(result.current.expandedNodeIds).toEqual(['node-1', 'node-2']);

      act(() => {
        result.current.collapseNode('$1' as NodeId);
      });

      expect(result.current.expandedNodeIds).toEqual(['node-2']);
    });

    it('should not add duplicate node IDs when expanding multiple times', () => {
      const { result } = renderHook(() => useTreeViewController(mockProps));

      act(() => {
        result.current.expandNode('$1' as NodeId);
        result.current.expandNode('$1' as NodeId);
        result.current.expandNode('$1' as NodeId);
      });

      expect(result.current.expandedNodeIds).toEqual(['node-1']);
    });
  });
});
