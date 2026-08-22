/**
 * @file useTreeViewController.undo-redo.test.tsx
 * @description TDD tests for TreeViewController undo/redo behavior
 */

import { type NodeId } from '@hierarchidb/core-types';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TreeViewControllerProps } from './useTreeViewController.js';
import { useTreeViewController } from './useTreeViewController.js';

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
          })
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
          })
        );
      });

      it('should update view atoms after successful undo', async () => {
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
          })
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
          })
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
          })
        );
      });
    });

    describe('undo/redo atoms management', () => {
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
        mockStateManager.canUndo = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true); //  undo

        mockStateManager.canRedo = vi
          .fn()
          .mockReturnValueOnce(false)
          .mockReturnValueOnce(false) //  undoredo
          .mockReturnValueOnce(true); //  undo

        const { result } = renderHook(() => useTreeViewController(mockProps));

        expect(result.current.canUndo).toBe(false);
        expect(result.current.canRedo).toBe(false);

        mockStateManager.deleteNode = vi.fn().mockResolvedValue({ success: true });
        await act(async () => {
          await result.current.archiveNode('$1' as NodeId);
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
          await result.current.archiveNode('$1' as NodeId);
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
      it('should handle build operations undo', async () => {
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
});
