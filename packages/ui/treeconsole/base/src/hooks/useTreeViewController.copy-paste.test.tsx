/**
 * @file useTreeViewController.copy-paste.test.tsx
 * @description TDD tests for TreeViewController copy/paste behavior
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
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
});
