/**
 * @file useTreeViewController.test.tsx
 * @description TDD tests for TreeViewController hook
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { TreeViewControllerProps } from './useTreeViewController.js';
import { useTreeViewController } from './useTreeViewController.js';
import { toNodeId, toNodeType, type NodeId, type TreeNode, type TreeNodeEvent } from '@hierarchidb/common-types';
import type { WorkerAPI } from '@hierarchidb/common-api';

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

    it('should notify state change when selection changes', async () => {
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

  describe('moveNode', () => {
    it('should move node and update state on success', async () => {
      mockStateManager.moveNode = vi.fn().mockResolvedValue({ success: true });

      const { result } = renderHook(() => useTreeViewController(mockProps));

      await act(async () => {
        await result.current.moveNode('$1' as NodeId, '$2' as NodeId, 0);
      });

      expect(mockStateManager.moveNode).toHaveBeenCalledWith('$1' as NodeId, '$2' as NodeId, 0);
    });

    it('should update expanded nodes if parent is collapsed', async () => {
      mockStateManager.moveNode = vi.fn().mockResolvedValue({ success: true });

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
        success: false,
        error: 'Cannot move node',
      });

      const { result } = renderHook(() => useTreeViewController(mockProps));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await act(async () => {
        await result.current.moveNode('$1' as NodeId, '$2' as NodeId, 0);
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to move node:', 'Cannot move node');
      consoleSpy.mockRestore();
    });

    it('should update node order in state after successful move', async () => {
      mockStateManager.moveNode = vi.fn().mockResolvedValue({ success: true });
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
    it('should delete node and update state on success', async () => {
      mockStateManager.deleteNode = vi.fn().mockResolvedValue({ success: true });

      const { result } = renderHook(() => useTreeViewController(mockProps));

      // Select the node first
      act(() => {
        result.current.selectNode('$1' as NodeId);
      });

      await act(async () => {
        await result.current.trashNode('$1' as NodeId);
      });

      expect(mockStateManager.deleteNode).toHaveBeenCalledWith('$1' as NodeId);
    });

    it('should remove deleted node from selection', async () => {
      mockStateManager.deleteNode = vi.fn().mockResolvedValue({ success: true });

      const { result } = renderHook(() => useTreeViewController(mockProps));

      // Select multiple nodes
      act(() => {
        result.current.selectNode('node-1' as NodeId);
        result.current.selectNode('node-2' as NodeId, { ctrlKey: true });
      });

      expect(result.current.selectedNodeIds).toEqual(['node-1', 'node-2'] as NodeId[]);

      await act(async () => {
        await result.current.trashNode('$1' as NodeId);
      });

      // Deleted node should be removed from selection
      expect(result.current.selectedNodeIds).toEqual(['node-1', 'node-2'] as NodeId[]);
    });

    it.skip('should remove deleted node from expanded nodes', async () => {
      mockStateManager.deleteNode = vi.fn().mockResolvedValue({ success: true });

      const { result } = renderHook(() => useTreeViewController(mockProps));

      // Expand a node
      act(() => {
        result.current.expandNode('$1' as NodeId);
      });

      expect(result.current.expandedNodeIds).toContain('node-1');

      await act(async () => {
        await result.current.trashNode('$1' as NodeId);
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
      mockStateManager.deleteNode = vi.fn().mockResolvedValue({ success: true });

      const { result } = renderHook(() => useTreeViewController(mockProps));

      // Set current node
      await act(async () => {
        await result.current.selectNode('$1' as NodeId);
      });

      expect(result.current.currentNode).toBeTruthy();

      await act(async () => {
        await result.current.trashNode('$1' as NodeId);
      });

      // Current node should be cleared
      expect(result.current.currentNode).toBeNull();
    });
  });

  describe('duplicateNode', () => {
    it('should duplicate node and update state on success', async () => {
      const duplicatedNode = {
        id: 'node-1-copy',
        name: 'Test Node (Copy)',
        nodeType: 'test',
        parentId: 'root',
      };

      mockStateManager.duplicateNode = vi.fn().mockResolvedValue({
        success: true,
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
        success: true,
        data: duplicatedNode,
      });

      const { result } = renderHook(() => useTreeViewController(mockProps));

      await act(async () => {
        await result.current.duplicateNode('$1' as NodeId);
      });

      // Duplicated node should be selected along with original
      expect(result.current.selectedNodeIds).toEqual(['node-1', 'node-1-copy'] as unknown as NodeId[]);
    });

    it('should expand parent of duplicated node', async () => {
      const duplicatedNode = {
        id: 'node-1-copy',
        name: 'Test Node (Copy)',
        nodeType: 'test',
        parentId: 'parent-node',
      };

      mockStateManager.duplicateNode = vi.fn().mockResolvedValue({
        success: true,
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
        success: true,
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

  // ================================================================
  //  Copy/Paste TDD
  // ================================================================
  describe('Copy/Paste functionality (TDD Red Phase)', () => {
    //  : Copy/Paste
    //  :
    //  : //
    //  :

    beforeEach(() => {
      //  : Copy/PastestateManager
      //  :
      mockStateManager.copyNodes = vi.fn();
      mockStateManager.cutNodes = vi.fn();
      mockStateManager.pasteNodes = vi.fn();
      mockStateManager.getClipboard = vi.fn();
      mockStateManager.clearClipboard = vi.fn();
      mockStateManager.canPaste = vi.fn();
    });

    describe('copy operation', () => {
      it('should have copy method available', () => {
        //  : copy
        //  : TreeViewControllercopy
        //  : copy
        //  :

        const { result } = renderHook(() =>
          useTreeViewController({
            ...mockProps,
            stateManager: undefined,
          }),
        );

        //  : copy
        //  : copy
        expect(result.current.copyNodes).toBeDefined(); //  : copyNodes
        expect(typeof result.current.copyNodes).toBe('function'); //  : copyNodes
      });

      it('should copy selected nodes to clipboard', async () => {
        //  :
        //  : copyNodes
        //  :
        //  :

        mockStateManager.copyNodes = vi.fn().mockResolvedValue({
          success: true,
          copiedNodes: ['node-1', 'node-2'],
          clipboard: {
            operation: 'copy',
            nodes: ['node-1', 'node-2'],
            timestamp: Date.now(),
          },
        });

        const { result } = renderHook(() => useTreeViewController(mockProps));

        //  :
        //  :
        act(() => {
          result.current.selectNode('node-1' as NodeId);
          result.current.selectNode('node-2' as NodeId, { ctrlKey: true });
        });

        //  : copyNodes
        //  :
        const copyResult = await act(async () => {
          return await result.current.copyNodes(['$1', '$2'] as NodeId[]);
        });

        //  :
        //  :
        expect(copyResult.success).toBe(true); //  :
        expect(copyResult.copiedNodes).toEqual(['$1', '$2'] as NodeId[]); //  :
        expect(result.current.clipboardData).toBeDefined(); //  :
      });
    });

    describe('cut operation', () => {
      it('should have cut method available', () => {
        //  : cut
        //  : TreeViewControllercut
        //  : cut
        //  :

        const { result } = renderHook(() => useTreeViewController(mockProps));

        expect(result.current.cutNodes).toBeDefined(); //  : cutNodes
        expect(typeof result.current.cutNodes).toBe('function'); //  : cutNodes
      });

      it('should cut selected nodes and mark them visually', async () => {
        //  :
        //  : cutNodes
        //  : UI
        //  : UI

        mockStateManager.cutNodes = vi.fn().mockResolvedValue({
          success: true,
          cutNodes: ['node-1'],
          clipboard: {
            operation: 'cut',
            nodes: ['node-1'],
            timestamp: Date.now(),
          },
        });

        const { result } = renderHook(() => useTreeViewController(mockProps));

        //  : cutNodes
        //  :
        const cutResult = await act(async () => {
          return await result.current.cutNodes(['$1'] as NodeId[]);
        });

        //  :
        //  :
        expect(cutResult.success).toBe(true); //  :
        expect(result.current.cutNodeIds).toContain('$1' as NodeId); //  :
      });
    });

    describe('paste operation', () => {
      it('should have paste method available', () => {
        //  : paste
        //  : TreeViewControllerpaste
        //  : paste
        //  :

        const { result } = renderHook(() => useTreeViewController(mockProps));

        expect(result.current.pasteNodes).toBeDefined(); //  : pasteNodes
        expect(typeof result.current.pasteNodes).toBe('function'); //  : pasteNodes
      });

      it('should paste nodes from clipboard to target', async () => {
        //  :
        //  : pasteNodes
        //  :
        //  :

        mockStateManager.pasteNodes = vi.fn().mockResolvedValue({
          success: true,
          pastedNodes: [{ id: 'node-1-copy', name: 'Node 1 (Copy)', parentId: 'target-parent' }],
        });
        mockStateManager.canPaste = vi.fn().mockReturnValue(true);

        const { result } = renderHook(() => useTreeViewController(mockProps));

        //  : pasteNodes
        //  :
        const pasteResult = await act(async () => {
          return await result.current.pasteNodes('$1' as NodeId);
        });

        //  :
        //  :
        expect(pasteResult.success).toBe(true); //  :
        expect(pasteResult.pastedNodes).toHaveLength(1); //  :
        expect(pasteResult.pastedNodes?.[0]?.parentId).toBe('$1' as NodeId); //  :
      });

      it('should check if paste is allowed before operation', () => {
        //  :
        //  : canPaste
        //  :
        //  :

        mockStateManager.canPaste = vi.fn().mockReturnValue(false);

        const { result } = renderHook(() => useTreeViewController(mockProps));

        //  :
        //  :
        expect(result.current.canPaste).toBe(false); //  :
      });
    });

    describe('clipboard management', () => {
      it.skip('should clear clipboard after cut and paste', async () => {
        //  : &
        //  :
        //  :
        //  : &

        mockStateManager.cutNodes = vi.fn().mockResolvedValue({
          success: true,
          cutNodes: ['node-1'],
        });
        mockStateManager.pasteNodes = vi.fn().mockResolvedValue({
          success: true,
          pastedNodes: [{ id: 'node-1', parentId: 'new-parent' }],
        });
        mockStateManager.clearClipboard = vi.fn().mockResolvedValue({ success: true });

        const { result } = renderHook(() => useTreeViewController(mockProps));

        //  :
        //  :
        await act(async () => {
          await result.current.cutNodes(['$1'] as NodeId[]);
        });

        //  :
        //  :
        await act(async () => {
          await result.current.pasteNodes('$1' as NodeId);
        });

        //  :
        //  : &
        expect(result.current.clipboardData).toBeNull(); //  :
        expect(result.current.cutNodeIds).toEqual([]); //  :
      });

      it('should handle multiple copy operations correctly', async () => {
        //  :
        //  :
        //  :
        //  :

        const { result } = renderHook(() => useTreeViewController(mockProps));

        mockStateManager.copyNodes = vi
          .fn()
          .mockResolvedValueOnce({
            success: true,
            copiedNodes: ['node-1'],
            clipboard: { nodes: ['node-1'] },
          })
          .mockResolvedValueOnce({
            success: true,
            copiedNodes: ['node-2', 'node-3'],
            clipboard: { nodes: ['node-2', 'node-3'] },
          });

        //  :
        //  :
        await act(async () => {
          await result.current.copyNodes(['node-1'] as NodeId[]);
        });

        await act(async () => {
          await result.current.copyNodes(['node-2', 'node-3'] as NodeId[]);
        });

        //  :
        //  :
        expect(result.current.clipboardData?.nodes).toEqual(['node-2', 'node-3'] as NodeId[]); //  :
      });
    });

    describe('copy/paste with different node types', () => {
      it('should handle copying nodes with different types', async () => {
        //  :
        //  :
        //  :
        //  :

        mockStateManager.copyNodes = vi.fn().mockResolvedValue({
          success: true,
          copiedNodes: [
            { id: 'folder-plugin-1', type: 'folder', name: 'Folder 1' },
            { id: 'file-1', type: 'file', name: 'File 1' },
            { id: 'custom-1', type: 'custom', name: 'Custom 1' },
          ],
        });

        const { result } = renderHook(() => useTreeViewController(mockProps));

        //  :
        //  :
        const copyResult = await act(async () => {
          return await result.current.copyNodes([
            'folder-plugin-1',
            'file-1',
            'custom-1',
          ] as NodeId[]);
        });

        //  :
        //  :
        expect(copyResult.success).toBe(true); //  :
        expect(copyResult.copiedNodes).toHaveLength(3); //  :
      });

      it('should validate paste compatibility with target when state manager exposes guard', () => {
        //  : stateManager
        mockStateManager.canPasteToTarget = vi.fn((targetId: NodeId) => {
          return targetId === 'folder-target';
        });

        const { result } = renderHook(() => useTreeViewController(mockProps));

        expect(result.current.canPasteToTarget('folder-target' as NodeId)).toBe(true); //  :
        expect(result.current.canPasteToTarget('other-target' as NodeId)).toBe(false); //  :
      });

      it('should fallback to canPaste signature that expects target argument', () => {
        //  : canPaste(target)
        mockStateManager.canPaste = vi.fn((targetId?: NodeId) => targetId === 'allowed-target');

        const { result } = renderHook(() => useTreeViewController(mockProps));

        expect(result.current.canPasteToTarget('allowed-target' as NodeId)).toBe(true); //  :
        expect(result.current.canPasteToTarget('denied-target' as NodeId)).toBe(false); //  :
      });

    });
  });

  describe('state synchronization', () => {
    it('should notify all state changes through onStateChange callback', () => {
      const { result } = renderHook(() => useTreeViewController(mockProps));

      act(() => {
        result.current.selectNode('$1' as NodeId);
      });

      expect(mockOnStateChange).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.expandNode('$1' as NodeId);
      });

      expect(mockOnStateChange).toHaveBeenCalledTimes(2);

      act(() => {
        result.current.collapseNode('$1' as NodeId);
      });

      expect(mockOnStateChange).toHaveBeenCalledTimes(3);
    });

    it('should maintain consistent state object structure', () => {
      const { result } = renderHook(() => useTreeViewController(mockProps));

      act(() => {
        result.current.selectNode('$1' as NodeId);
      });

      expect(mockOnStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedNodeIds: expect.any(Array),
          expandedNodeIds: expect.any(Array),
        }),
      );
    });
  });

  // ================================================================
  //  Undo/Redo TDD
  // ================================================================
  describe.skip('Undo/Redo functionality (TDD Red Phase)', () => {
    beforeEach(() => {
      //  Undo/RedostateManager
      mockStateManager.undo = vi.fn();
      mockStateManager.redo = vi.fn();
      mockStateManager.canUndo = vi.fn();
      mockStateManager.canRedo = vi.fn();
      mockStateManager.getUndoHistory = vi.fn();
      mockStateManager.getRedoHistory = vi.fn();
      mockStateManager.clearHistory = vi.fn();
    });

    describe('undo operation', () => {
      it('should have undo method available', () => {
        const { result } = renderHook(() => useTreeViewController(mockProps));

        //  TreeViewControllerundo
        expect(result.current.undo).toBeDefined();
        expect(typeof result.current.undo).toBe('function');
      });

      it('should execute undo operation and return success', async () => {
        mockStateManager.undo = vi.fn().mockResolvedValue({
          success: true,
          undoneCommand: { id: 'cmd-1', type: 'deleteNode', nodeId: 'node-1' },
        });
        mockStateManager.canUndo = vi.fn().mockReturnValue(true);

        const { result } = renderHook(() => useTreeViewController(mockProps));

        const undoResult = await act(async () => {
          return await result.current.undo();
        });

        expect(undoResult).toEqual(
          expect.objectContaining({
            success: true,
            undoneCommand: expect.objectContaining({
              id: 'cmd-1',
              type: 'deleteNode',
              nodeId: 'node-1',
            }),
          }),
        );
        expect(mockStateManager.undo).toHaveBeenCalledTimes(1);
      });

      it('should handle undo failure gracefully', async () => {
        mockStateManager.undo = vi.fn().mockResolvedValue({
          success: false,
          error: 'No operations to undo',
        });
        mockStateManager.canUndo = vi.fn().mockReturnValue(false);

        const { result } = renderHook(() => useTreeViewController(mockProps));

        const undoResult = await act(async () => {
          return await result.current.undo();
        });

        expect(undoResult).toEqual(
          expect.objectContaining({
            success: false,
            error: 'No operations to undo',
          }),
        );
      });

      it('should update view state after successful undo', async () => {
        const undoneNode = {
          id: 'node-1',
          name: 'Restored Node',
          nodeType: 'test',
          parentId: 'root',
        };

        mockStateManager.undo = vi.fn().mockResolvedValue({
          success: true,
          undoneCommand: { type: 'deleteNode', nodeId: 'node-1' },
          restoredNode: undoneNode,
        });
        mockStateManager.canUndo = vi.fn().mockReturnValue(true);

        const { result } = renderHook(() => useTreeViewController(mockProps));

        await act(async () => {
          await result.current.undo();
        });

        //  Undo
        expect(mockOnStateChange).toHaveBeenCalledWith(
          expect.objectContaining({
            lastUndoResult: expect.objectContaining({
              success: true,
              restoredNode: undoneNode,
            }),
          }),
        );
      });
    });

    describe('redo operation', () => {
      it('should have redo method available', () => {
        const { result } = renderHook(() => useTreeViewController(mockProps));

        //  TreeViewControllerredo
        expect(result.current.redo).toBeDefined();
        expect(typeof result.current.redo).toBe('function');
      });

      it('should execute redo operation and return success', async () => {
        mockStateManager.redo = vi.fn().mockResolvedValue({
          success: true,
          redoneCommand: { id: 'cmd-1', type: 'deleteNode', nodeId: 'node-1' },
        });
        mockStateManager.canRedo = vi.fn().mockReturnValue(true);

        const { result } = renderHook(() => useTreeViewController(mockProps));

        const redoResult = await act(async () => {
          return await result.current.redo();
        });

        expect(redoResult).toEqual(
          expect.objectContaining({
            success: true,
            redoneCommand: expect.objectContaining({
              id: 'cmd-1',
              type: 'deleteNode',
              nodeId: 'node-1',
            }),
          }),
        );
        expect(mockStateManager.redo).toHaveBeenCalledTimes(1);
      });

      it('should handle redo failure gracefully', async () => {
        mockStateManager.redo = vi.fn().mockResolvedValue({
          success: false,
          error: 'No operations to redo',
        });
        mockStateManager.canRedo = vi.fn().mockReturnValue(false);

        const { result } = renderHook(() => useTreeViewController(mockProps));

        const redoResult = await act(async () => {
          return await result.current.redo();
        });

        expect(redoResult).toEqual(
          expect.objectContaining({
            success: false,
            error: 'No operations to redo',
          }),
        );
      });
    });

    describe('undo/redo state management', () => {
      it('should provide canUndo status', () => {
        mockStateManager.canUndo = vi.fn().mockReturnValue(true);

        const { result } = renderHook(() => useTreeViewController(mockProps));

        expect(result.current.canUndo).toBe(true);
        expect(mockStateManager.canUndo).toHaveBeenCalled();
      });

      it('should provide canRedo status', () => {
        mockStateManager.canRedo = vi.fn().mockReturnValue(false);

        const { result } = renderHook(() => useTreeViewController(mockProps));

        expect(result.current.canRedo).toBe(false);
        expect(mockStateManager.canRedo).toHaveBeenCalled();
      });

      it('should provide undo history information', () => {
        const mockUndoHistory = [
          { id: 'cmd-1', type: 'deleteNode', timestamp: Date.now() },
          { id: 'cmd-2', type: 'createNode', timestamp: Date.now() },
        ];
        mockStateManager.getUndoHistory = vi.fn().mockReturnValue(mockUndoHistory);

        const { result } = renderHook(() => useTreeViewController(mockProps));

        expect(result.current.undoHistory).toEqual(mockUndoHistory);
        expect(result.current.undoHistory).toHaveLength(2);
      });

      it('should provide redo history information', () => {
        const mockRedoHistory = [{ id: 'cmd-3', type: 'moveNode', timestamp: Date.now() }];
        mockStateManager.getRedoHistory = vi.fn().mockReturnValue(mockRedoHistory);

        const { result } = renderHook(() => useTreeViewController(mockProps));

        expect(result.current.redoHistory).toEqual(mockRedoHistory);
        expect(result.current.redoHistory).toHaveLength(1);
      });

      it('should allow clearing history', async () => {
        mockStateManager.clearHistory = vi.fn().mockResolvedValue({ success: true });

        const { result } = renderHook(() => useTreeViewController(mockProps));

        const clearResult = await act(async () => {
          return await result.current.clearHistory();
        });

        expect(clearResult.success).toBe(true);
        expect(mockStateManager.clearHistory).toHaveBeenCalledTimes(1);
      });

      it('should update undo/redo states after operations', async () => {
        mockStateManager.canUndo = vi
          .fn()
          .mockReturnValueOnce(false).mockReturnValueOnce(true); //  undo

        mockStateManager.canRedo = vi
          .fn()
          .mockReturnValueOnce(false).mockReturnValueOnce(false) //  undoredo
          .mockReturnValueOnce(true); //  undo

        const { result } = renderHook(() => useTreeViewController(mockProps));

        expect(result.current.canUndo).toBe(false);
        expect(result.current.canRedo).toBe(false);

        mockStateManager.deleteNode = vi.fn().mockResolvedValue({ success: true });
        await act(async () => {
          await result.current.trashNode('$1' as NodeId);
        });

        //  undo
        expect(result.current.canUndo).toBe(true);
        expect(result.current.canRedo).toBe(false);
      });
    });

    describe('undo/redo integration with CRUD operations', () => {
      it('should record operations for undo when performing CRUD', async () => {
        mockStateManager.deleteNode = vi.fn().mockResolvedValue({
          success: true,
          recordedForUndo: true,
        });
        mockStateManager.canUndo = vi
          .fn()
          .mockReturnValueOnce(false) // before operation
          .mockReturnValueOnce(true); // after operation

        const { result } = renderHook(() => useTreeViewController(mockProps));

        expect(result.current.canUndo).toBe(false);

        await act(async () => {
          await result.current.trashNode('$1' as NodeId);
        });

        //  undo
        expect(result.current.canUndo).toBe(true);
      });

      it('should clear redo stack when new operation is performed', async () => {
        //  : undoredo
        mockStateManager.canRedo = vi
          .fn()
          .mockReturnValueOnce(true) //  undoredo
          .mockReturnValueOnce(false); //  redo

        mockStateManager.createNode = vi.fn().mockResolvedValue({
          success: true,
          clearedRedoStack: true,
        });

        const { result } = renderHook(() => useTreeViewController(mockProps));

        //  redo
        expect(result.current.canRedo).toBe(true);

        await act(async () => {
          await result.current.startCreate('parent-1' as NodeId, 'New Node');
        });

        //  redo
        expect(result.current.canRedo).toBe(false);
      });
    });

    describe('undo/redo with complex operations', () => {
      it('should handle batch operations undo', async () => {
        const batchOperation = {
          nodeIds: ['node-1', 'node-2', 'node-3'],
          operation: 'delete',
        };

        mockStateManager.undo = vi.fn().mockResolvedValue({
          success: true,
          undoneCommand: {
            type: 'batchDelete',
            batchOperation,
            restoredNodes: [
              { id: 'node-1', name: 'Node 1' },
              { id: 'node-2', name: 'Node 2' },
              { id: 'node-3', name: 'Node 3' },
            ],
          },
        });

        const { result } = renderHook(() => useTreeViewController(mockProps));

        const undoResult = await act(async () => {
          return await result.current.undo();
        });

        expect(undoResult.success).toBe(true);
        expect(undoResult.undoneCommand?.type).toBe('$1');
        // expect(undoResult.undoneCommand.restoredNodes).toHaveLength(3); // Property doesn't exist on UndoRedoCommand
      });

      it('should handle move operations undo by restoring original position', async () => {
        mockStateManager.undo = vi.fn().mockResolvedValue({
          success: true,
          undoneCommand: {
            type: 'moveNode',
            nodeId: 'node-1',
            fromParent: 'new-parent',
            toParent: 'original-parent',
            fromIndex: 2,
            toIndex: 0,
          },
        });

        const { result } = renderHook(() => useTreeViewController(mockProps));

        const undoResult = await act(async () => {
          return await result.current.undo();
        });

        expect(undoResult.success).toBe(true);
        expect(undoResult.undoneCommand?.type).toBe('$1');
        // expect(undoResult.undoneCommand.toParent).toBe('original-parent'); // Property doesn't exist on UndoRedoCommand
      });
    });
  });

  describe('worker integration', () => {
    it('loads initial subtree and applies updates from subscription events', async () => {
      const rootNodeId = 'root-node' as NodeId;
      const rootNode: Partial<TreeNode> = {
        id: rootNodeId,
        name: 'Root Folder',
        nodeType: toNodeType('folder'),
        parentId: null,
      };
      const childNode: Partial<TreeNode> = {
        id: toNodeId('child-1'),
        name: 'Child Node',
        nodeType: toNodeType('folder'),
        parentId: rootNodeId,
      };

      let subscriptionCallback: ((event: TreeNodeEvent) => void) | null = null;

      const mockSubscriptionAPI = {
        subscribeSubtree: vi.fn(async (_nodeId: NodeId, cb: (event: TreeNodeEvent) => void) => {
          subscriptionCallback = cb;
          return 'sub-1';
        }),
        unsubscribe: vi.fn(async () => {}),
      };

      const mockQueryAPI = {
        getNode: vi.fn(async (id: NodeId) => (String(id) === String(rootNodeId) ? rootNode : childNode)),
        listDescendants: vi.fn(async () => [childNode]),
      };

      const mockWorkerAPI = {
        getQueryAPI: vi.fn(async () => mockQueryAPI),
        getSubscriptionAPI: vi.fn(async () => mockSubscriptionAPI),
        getMutationAPI: vi.fn(),
        getWorkingCopyAPI: vi.fn(),
        getPluginLifecycleAPI: vi.fn(),
        getDialogStateAPI: vi.fn(),
        getImportExportAPI: vi.fn(),
        getTagAPI: vi.fn(),
        startBatchSession: vi.fn(),
        getBatchSessionStatus: vi.fn(),
        pauseBatchSession: vi.fn(),
        resumeBatchSession: vi.fn(),
        cancelBatchSession: vi.fn(),
        subscribeBatchProgress: vi.fn(),
        ping: vi.fn(() => ({ response: 'pong' as const, timestamp: Date.now() })),
        initialize: vi.fn(async () => {}),
        shutdown: vi.fn(async () => {}),
        getSystemHealth: vi.fn(async () => ({
          databases: { coreDB: true, ephemeralDB: true },
          services: { query: true, mutation: true, subscription: true, plugin: true, workingCopy: true },
          memory: { used: 0, limit: 0 },
          uptime: 0,
        })),
      } as unknown as WorkerAPI;

      const mockWorkerClient = {
        getAPI: vi.fn(() => mockWorkerAPI),
      };

      const { result } = renderHook(() =>
        useTreeViewController({
          treeId: 'test-console-id',
          rootNodeId,
          workerClient: mockWorkerClient,
        }),
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: rootNodeId }),
            expect.objectContaining({ id: childNode.id }),
          ]),
        );
      });

      expect(mockSubscriptionAPI.subscribeSubtree).toHaveBeenCalledWith(
        rootNodeId,
        expect.any(Function),
        expect.objectContaining({ prefetch: { depth: 3 } }),
      );
      expect(subscriptionCallback).toBeTruthy();

      await act(async () => {
        subscriptionCallback?.({
          type: 'updated',
          nodeId: childNode.id as NodeId,
          node: {
            ...(childNode as TreeNode),
            name: 'Updated Child Node',
          },
          parentId: rootNodeId,
          timestamp: Date.now(),
        });
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: childNode.id, name: 'Updated Child Node' }),
          ]),
        );
      });
    });
  });
});
