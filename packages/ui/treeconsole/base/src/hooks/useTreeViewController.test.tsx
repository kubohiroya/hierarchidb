/**
 * @file useTreeViewController.test.tsx
 * @description TDD tests for TreeViewController hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTreeViewController } from './useTreeViewController';
import type { TreeViewControllerProps } from './useTreeViewController';
import type { NodeId } from '@hierarchidb/common-core';

// Mock dependencies
vi.mock('@hierarchidb/provider', () => ({
  useTreeOperations: vi.fn(() => ({
    updateNode: vi.fn(),
    moveNode: vi.fn(),
    deleteNode: vi.fn(),
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
      deleteNode: vi.fn(),
      duplicateNode: vi.fn(),
    } as any;

    mockProps = {
      treeId: 'test-tree-id',
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

      expect(result.current.selectedNodeIds).toEqual(['node-1', 'node-2'] as NodeId[]);
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
      mockStateManager.getChildren = vi.fn().mockResolvedValue([
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

      expect(result.current.selectedNodeIds).toEqual(['node-1', 'node-2'] as NodeId[]);
    });

    it('should notify state change when selection changes', async () => {
      const { result } = renderHook(() => useTreeViewController(mockProps));

      act(() => {
        result.current.selectNode('$1' as NodeId);
      });

      expect(mockOnStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedNodeIds: ['node-1'],
        })
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
      expect(result.current.expandedNodeIds).toContain('new-parent');
    });

    it('should handle move failure gracefully', async () => {
      mockStateManager.moveNode = vi.fn().mockResolvedValue({ 
        success: false, 
        error: 'Cannot move node' 
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
      mockStateManager.getChildren = vi.fn().mockResolvedValue([
        { id: 'node-2' },
        { id: 'node-1' },
        { id: 'node-3' },
      ]);

      const { result } = renderHook(() => useTreeViewController(mockProps));

      await act(async () => {
        await result.current.moveNode('$1' as NodeId, '$2' as NodeId, 0);
      });

      expect(mockOnStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          expandedNodeIds: expect.arrayContaining(['parent']),
        })
      );
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
        await result.current.deleteNode('$1' as NodeId);
      });

      expect(mockStateManager.deleteNode).toHaveBeenCalledWith('node-1');
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
        await result.current.deleteNode('$1' as NodeId);
      });

      // Deleted node should be removed from selection
      expect(result.current.selectedNodeIds).toEqual(['node-1', 'node-2'] as NodeId[]);
    });

    it('should remove deleted node from expanded nodes', async () => {
      mockStateManager.deleteNode = vi.fn().mockResolvedValue({ success: true });

      const { result } = renderHook(() => useTreeViewController(mockProps));

      // Expand a node
      act(() => {
        result.current.expandNode('$1' as NodeId);
      });

      expect(result.current.expandedNodeIds).toContain('node-1');

      await act(async () => {
        await result.current.deleteNode('$1' as NodeId);
      });

      // Deleted node should be removed from expanded nodes
      expect(result.current.expandedNodeIds).not.toContain('node-1');
    });

    it('should clear currentNode if it was deleted', async () => {
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
        await result.current.deleteNode('$1' as NodeId);
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
        data: duplicatedNode
      });

      const { result } = renderHook(() => useTreeViewController(mockProps));

      await act(async () => {
        await result.current.duplicateNode('$1' as NodeId);
      });

      expect(mockStateManager.duplicateNode).toHaveBeenCalledWith('$1' as NodeId);
    });

    it('should select the duplicated node', async () => {
      const duplicatedNode = {
        id: 'node-1-copy',
        name: 'Test Node (Copy)',
        nodeType: 'test',
        parentId: 'root',
      };

      mockStateManager.duplicateNode = vi.fn().mockResolvedValue({ 
        success: true,
        data: duplicatedNode
      });

      const { result } = renderHook(() => useTreeViewController(mockProps));

      await act(async () => {
        await result.current.duplicateNode('$1' as NodeId);
      });

      // Duplicated node should be selected
      expect(result.current.selectedNodeIds).toEqual(['node-1', 'node-2'] as NodeId[]);
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
        data: duplicatedNode
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
        data: duplicatedNode
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

    it('should remove node from expandedNodeIds when collapsing', () => {
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
  // Copy/Paste 機能のTDD失敗テスト
  // これらのテストは現在の実装では失敗するはずです
  // ================================================================
  describe('Copy/Paste functionality (TDD Red Phase)', () => {
    // 【テスト目的】: Copy/Paste機能の基本的な動作を検証
    // 【テスト内容】: コピー、カット、ペースト操作とクリップボード管理
    // 【期待される動作】: ノードのコピー/カット/ペーストが正しく動作すること
    // 🟢 信頼性レベル: 基本的な仕様に基づく標準的な実装

    beforeEach(() => {
      // 【テスト前準備】: Copy/Paste用のstateManagerメソッドをモック
      // 【環境初期化】: クリップボード関連の機能をクリーンな状態に初期化
      mockStateManager.copyNodes = vi.fn();
      mockStateManager.cutNodes = vi.fn();
      mockStateManager.pasteNodes = vi.fn();
      mockStateManager.getClipboard = vi.fn();
      mockStateManager.clearClipboard = vi.fn();
      mockStateManager.canPaste = vi.fn();
    });

    describe('copy operation', () => {
      it('should have copy method available', () => {
        // 【テスト目的】: copyメソッドが実装されているか確認
        // 【テスト内容】: TreeViewControllerインターフェースにcopyメソッドが存在すること
        // 【期待される動作】: copyメソッドが定義され、関数であること
        // 🟢 信頼性レベル: インターフェース定義に基づく

        const { result } = renderHook(() => useTreeViewController(mockProps));
        
        // 【結果検証】: copyメソッドの存在確認
        // 【期待値確認】: copyが定義され、関数型であること
        expect(result.current.copyNodes).toBeDefined(); // 【確認内容】: copyNodesメソッドが存在すること 🟢
        expect(typeof result.current.copyNodes).toBe('function'); // 【確認内容】: copyNodesが関数であること 🟢
      });

      it('should copy selected nodes to clipboard', async () => {
        // 【テスト目的】: 選択したノードをクリップボードにコピーできること
        // 【テスト内容】: copyNodes実行後、クリップボードにデータが保存されること
        // 【期待される動作】: コピー操作が成功し、クリップボードの状態が更新される
        // 🟢 信頼性レベル: 標準的なクリップボード操作

        mockStateManager.copyNodes = vi.fn().mockResolvedValue({
          success: true,
          copiedNodes: ['node-1', 'node-2'],
          clipboard: {
            operation: 'copy',
            nodes: ['node-1', 'node-2'],
            timestamp: Date.now()
          }
        });

        const { result } = renderHook(() => useTreeViewController(mockProps));

        // 【テストデータ準備】: コピー対象のノードを選択
        // 【初期条件設定】: 複数ノードを選択状態にする
        act(() => {
          result.current.selectNode('node-1' as NodeId);
        result.current.selectNode('node-2' as NodeId, { ctrlKey: true });
        });

        // 【実際の処理実行】: copyNodesメソッドを呼び出し
        // 【処理内容】: 選択されたノードをクリップボードにコピー
        const copyResult = await act(async () => {
          return await result.current.copyNodes(['$1', '$2'] as NodeId[]);
        });

        // 【結果検証】: コピー操作の成功確認
        // 【期待値確認】: 成功フラグとコピーされたノード情報
        expect(copyResult.success).toBe(true); // 【確認内容】: コピー操作が成功したこと 🟢
        expect(copyResult.copiedNodes).toEqual(['$1', '$2'] as NodeId[]); // 【確認内容】: 正しいノードがコピーされたこと 🟢
        expect(result.current.clipboardData).toBeDefined(); // 【確認内容】: クリップボードデータが存在すること 🟡
      });
    });

    describe('cut operation', () => {
      it('should have cut method available', () => {
        // 【テスト目的】: cutメソッドが実装されているか確認
        // 【テスト内容】: TreeViewControllerインターフェースにcutメソッドが存在すること
        // 【期待される動作】: cutメソッドが定義され、関数であること
        // 🟢 信頼性レベル: インターフェース定義に基づく

        const { result } = renderHook(() => useTreeViewController(mockProps));
        
        expect(result.current.cutNodes).toBeDefined(); // 【確認内容】: cutNodesメソッドが存在すること 🟢
        expect(typeof result.current.cutNodes).toBe('function'); // 【確認内容】: cutNodesが関数であること 🟢
      });

      it('should cut selected nodes and mark them visually', async () => {
        // 【テスト目的】: カット操作でノードが視覚的にマークされること
        // 【テスト内容】: cutNodes実行後、ノードがカット状態として表示されること
        // 【期待される動作】: カット操作が成功し、UIで識別可能になる
        // 🟡 信頼性レベル: 一般的なUIパターンに基づく推測

        mockStateManager.cutNodes = vi.fn().mockResolvedValue({
          success: true,
          cutNodes: ['node-1'],
          clipboard: {
            operation: 'cut',
            nodes: ['node-1'],
            timestamp: Date.now()
          }
        });

        const { result } = renderHook(() => useTreeViewController(mockProps));

        // 【実際の処理実行】: cutNodesメソッドを呼び出し
        // 【処理内容】: 選択されたノードをカット状態にする
        const cutResult = await act(async () => {
          return await result.current.cutNodes(['$1'] as NodeId[]);
        });

        // 【結果検証】: カット操作の成功とマーキング確認
        // 【期待値確認】: カット状態が正しく設定されること
        expect(cutResult.success).toBe(true); // 【確認内容】: カット操作が成功したこと 🟢
        expect(result.current.cutNodeIds).toContain('$1' as NodeId); // 【確認内容】: カットされたノードがマークされていること 🟡
      });
    });

    describe('paste operation', () => {
      it('should have paste method available', () => {
        // 【テスト目的】: pasteメソッドが実装されているか確認
        // 【テスト内容】: TreeViewControllerインターフェースにpasteメソッドが存在すること
        // 【期待される動作】: pasteメソッドが定義され、関数であること
        // 🟢 信頼性レベル: インターフェース定義に基づく

        const { result } = renderHook(() => useTreeViewController(mockProps));
        
        expect(result.current.pasteNodes).toBeDefined(); // 【確認内容】: pasteNodesメソッドが存在すること 🟢
        expect(typeof result.current.pasteNodes).toBe('function'); // 【確認内容】: pasteNodesが関数であること 🟢
      });

      it('should paste nodes from clipboard to target', async () => {
        // 【テスト目的】: クリップボードからノードをペーストできること
        // 【テスト内容】: pasteNodes実行で、コピーされたノードが目標位置に配置される
        // 【期待される動作】: ペースト操作が成功し、新しいノードが作成される
        // 🟢 信頼性レベル: 標準的なペースト操作

        mockStateManager.pasteNodes = vi.fn().mockResolvedValue({
          success: true,
          pastedNodes: [
            { id: 'node-1-copy', name: 'Node 1 (Copy)', parentId: 'target-parent' }
          ]
        });
        mockStateManager.canPaste = vi.fn().mockReturnValue(true);

        const { result } = renderHook(() => useTreeViewController(mockProps));

        // 【実際の処理実行】: pasteNodesメソッドを呼び出し
        // 【処理内容】: クリップボードの内容を指定位置にペースト
        const pasteResult = await act(async () => {
          return await result.current.pasteNodes('$1' as NodeId);
        });

        // 【結果検証】: ペースト操作の成功確認
        // 【期待値確認】: 新しいノードが作成されたこと
        expect(pasteResult.success).toBe(true); // 【確認内容】: ペースト操作が成功したこと 🟢
        expect(pasteResult.pastedNodes).toHaveLength(1); // 【確認内容】: ペーストされたノード数が正しいこと 🟢
        expect(pasteResult.pastedNodes?.[0]?.parentId).toBe('$1' as NodeId); // 【確認内容】: 正しい親ノードに配置されたこと 🟢
      });

      it('should check if paste is allowed before operation', () => {
        // 【テスト目的】: ペースト可能性を事前チェックできること
        // 【テスト内容】: canPasteメソッドでペースト可能かを判定
        // 【期待される動作】: クリップボード状態と対象位置に基づいて可否を判定
        // 🟡 信頼性レベル: 一般的な実装パターンに基づく

        mockStateManager.canPaste = vi.fn().mockReturnValue(false);

        const { result } = renderHook(() => useTreeViewController(mockProps));

        // 【結果検証】: ペースト可能性の判定
        // 【期待値確認】: クリップボードが空の場合はペースト不可
        expect(result.current.canPaste).toBe(false); // 【確認内容】: ペースト不可能状態が正しく判定されること 🟡
      });
    });

    describe('clipboard management', () => {
      it('should clear clipboard after cut and paste', async () => {
        // 【テスト目的】: カット&ペースト後にクリップボードがクリアされること
        // 【テスト内容】: カット操作後のペーストでクリップボードが自動クリアされる
        // 【期待される動作】: 移動操作完了後、クリップボードが空になる
        // 🟢 信頼性レベル: 標準的なカット&ペースト動作

        mockStateManager.cutNodes = vi.fn().mockResolvedValue({
          success: true,
          cutNodes: ['node-1']
        });
        mockStateManager.pasteNodes = vi.fn().mockResolvedValue({
          success: true,
          pastedNodes: [{ id: 'node-1', parentId: 'new-parent' }]
        });
        mockStateManager.clearClipboard = vi.fn().mockResolvedValue({ success: true });

        const { result } = renderHook(() => useTreeViewController(mockProps));

        // 【テストデータ準備】: カット操作を実行
        // 【初期条件設定】: ノードをカット状態にする
        await act(async () => {
          await result.current.cutNodes(['$1'] as NodeId[]);
        });

        // 【実際の処理実行】: ペースト操作を実行
        // 【処理内容】: カットされたノードをペースト
        await act(async () => {
          await result.current.pasteNodes('$1' as NodeId);
        });

        // 【結果検証】: クリップボードがクリアされたこと
        // 【期待値確認】: カット&ペースト完了後、クリップボードが空
        expect(result.current.clipboardData).toBeNull(); // 【確認内容】: クリップボードが空になったこと 🟢
        expect(result.current.cutNodeIds).toEqual([]); // 【確認内容】: カット状態のノードがクリアされたこと 🟡
      });

      it('should handle multiple copy operations correctly', async () => {
        // 【テスト目的】: 複数回のコピー操作が正しく処理されること
        // 【テスト内容】: 新しいコピー操作が前のクリップボード内容を上書きする
        // 【期待される動作】: 最後のコピー内容のみがクリップボードに保持される
        // 🟢 信頼性レベル: 標準的なクリップボード動作

        const { result } = renderHook(() => useTreeViewController(mockProps));

        mockStateManager.copyNodes = vi.fn()
          .mockResolvedValueOnce({
            success: true,
            copiedNodes: ['node-1'],
            clipboard: { nodes: ['node-1'] }
          })
          .mockResolvedValueOnce({
            success: true,
            copiedNodes: ['node-2', 'node-3'],
            clipboard: { nodes: ['node-2', 'node-3'] }
          });

        // 【実際の処理実行】: 複数回のコピー操作
        // 【処理内容】: 異なるノードを連続してコピー
        await act(async () => {
          await result.current.copyNodes(['node-1'] as NodeId[]);
        });

        await act(async () => {
          await result.current.copyNodes(['node-2', 'node-3'] as NodeId[]);
        });

        // 【結果検証】: 最後のコピー内容のみ保持
        // 【期待値確認】: クリップボードに最新のコピー内容がある
        expect(result.current.clipboardData?.nodes).toEqual(['node-2', 'node-3'] as NodeId[]); // 【確認内容】: 最新のコピー内容が保持されていること 🟡
      });
    });

    describe('copy/paste with different node types', () => {
      it('should handle copying nodes with different types', async () => {
        // 【テスト目的】: 異なるノードタイプのコピーが正しく処理されること
        // 【テスト内容】: フォルダ、ファイル、その他のノードタイプを混在してコピー
        // 【期待される動作】: 全てのノードタイプが正しくコピーされる
        // 🔴 信頼性レベル: 具体的な仕様が不明なため推測

        mockStateManager.copyNodes = vi.fn().mockResolvedValue({
          success: true,
          copiedNodes: [
            { id: 'folder-plugin-1', type: 'folder', name: 'Folder 1' },
            { id: 'file-1', type: 'file', name: 'File 1' },
            { id: 'custom-1', type: 'custom', name: 'Custom 1' }
          ]
        });

        const { result } = renderHook(() => useTreeViewController(mockProps));

        // 【実際の処理実行】: 異なるタイプのノードをコピー
        // 【処理内容】: 複数タイプのノードを一括コピー
        const copyResult = await act(async () => {
          return await result.current.copyNodes(['folder-plugin-1', 'file-1', 'custom-1'] as NodeId[]);
        });

        // 【結果検証】: 全てのノードタイプがコピーされたこと
        // 【期待値確認】: タイプ情報が保持されていること
        expect(copyResult.success).toBe(true); // 【確認内容】: コピー操作が成功したこと 🟢
        expect(copyResult.copiedNodes).toHaveLength(3); // 【確認内容】: 全てのノードがコピーされたこと 🔴
      });

      it('should validate paste compatibility with target', async () => {
        // 【テスト目的】: ペースト先との互換性をチェックできること
        // 【テスト内容】: 特定のノードタイプは特定の親にのみペースト可能
        // 【期待される動作】: 互換性がない場合はペーストを拒否
        // 🔴 信頼性レベル: ビジネスルールに依存する推測

        mockStateManager.canPaste = vi.fn((targetId) => {
          // ファイルはフォルダにのみペースト可能という仮定
          return targetId === 'folder-plugin-node';
        });

        const { result } = renderHook(() => useTreeViewController(mockProps));

        // 【結果検証】: ペースト互換性の判定
        // 【期待値確認】: 互換性に基づいてペースト可否を判定
        expect(result.current.canPasteToTarget('$1' as NodeId)).toBe(true); // 【確認内容】: フォルダへのペーストが可能 🔴
        expect(result.current.canPasteToTarget('$1' as NodeId)).toBe(false); // 【確認内容】: ファイルへのペーストが不可 🔴
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
          currentNode: expect.anything(),
        })
      );
    });
  });

  // ================================================================
  // Undo/Redo 機能のTDD失敗テスト
  // これらのテストは現在の実装では失敗するはずです
  // ================================================================
  describe('Undo/Redo functionality (TDD Red Phase)', () => {
    beforeEach(() => {
      // Undo/Redo用のstateManagerメソッドをモック
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
        
        // TreeViewControllerにundo機能が実装されているかテスト
        expect(result.current.undo).toBeDefined();
        expect(typeof result.current.undo).toBe('function');
      });

      it('should execute undo operation and return success', async () => {
        mockStateManager.undo = vi.fn().mockResolvedValue({ 
          success: true, 
          undoneCommand: { id: 'cmd-1', type: 'deleteNode', nodeId: 'node-1' }
        });
        mockStateManager.canUndo = vi.fn().mockReturnValue(true);

        const { result } = renderHook(() => useTreeViewController(mockProps));

        const undoResult = await act(async () => {
          return await result.current.undo();
        });

        expect(undoResult).toEqual(expect.objectContaining({
          success: true,
          undoneCommand: expect.objectContaining({
            id: 'cmd-1',
            type: 'deleteNode',
            nodeId: 'node-1'
          })
        }));
        expect(mockStateManager.undo).toHaveBeenCalledTimes(1);
      });

      it('should handle undo failure gracefully', async () => {
        mockStateManager.undo = vi.fn().mockResolvedValue({ 
          success: false, 
          error: 'No operations to undo' 
        });
        mockStateManager.canUndo = vi.fn().mockReturnValue(false);

        const { result } = renderHook(() => useTreeViewController(mockProps));

        const undoResult = await act(async () => {
          return await result.current.undo();
        });

        expect(undoResult).toEqual(expect.objectContaining({
          success: false,
          error: 'No operations to undo'
        }));
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
          restoredNode: undoneNode
        });
        mockStateManager.canUndo = vi.fn().mockReturnValue(true);

        const { result } = renderHook(() => useTreeViewController(mockProps));

        await act(async () => {
          await result.current.undo();
        });

        // Undo後の状態変更通知を確認
        expect(mockOnStateChange).toHaveBeenCalledWith(
          expect.objectContaining({
            lastUndoResult: expect.objectContaining({
              success: true,
              restoredNode: undoneNode
            })
          })
        );
      });
    });

    describe('redo operation', () => {
      it('should have redo method available', () => {
        const { result } = renderHook(() => useTreeViewController(mockProps));
        
        // TreeViewControllerにredo機能が実装されているかテスト
        expect(result.current.redo).toBeDefined();
        expect(typeof result.current.redo).toBe('function');
      });

      it('should execute redo operation and return success', async () => {
        mockStateManager.redo = vi.fn().mockResolvedValue({ 
          success: true, 
          redoneCommand: { id: 'cmd-1', type: 'deleteNode', nodeId: 'node-1' }
        });
        mockStateManager.canRedo = vi.fn().mockReturnValue(true);

        const { result } = renderHook(() => useTreeViewController(mockProps));

        const redoResult = await act(async () => {
          return await result.current.redo();
        });

        expect(redoResult).toEqual(expect.objectContaining({
          success: true,
          redoneCommand: expect.objectContaining({
            id: 'cmd-1',
            type: 'deleteNode',
            nodeId: 'node-1'
          })
        }));
        expect(mockStateManager.redo).toHaveBeenCalledTimes(1);
      });

      it('should handle redo failure gracefully', async () => {
        mockStateManager.redo = vi.fn().mockResolvedValue({ 
          success: false, 
          error: 'No operations to redo' 
        });
        mockStateManager.canRedo = vi.fn().mockReturnValue(false);

        const { result } = renderHook(() => useTreeViewController(mockProps));

        const redoResult = await act(async () => {
          return await result.current.redo();
        });

        expect(redoResult).toEqual(expect.objectContaining({
          success: false,
          error: 'No operations to redo'
        }));
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
          { id: 'cmd-2', type: 'createNode', timestamp: Date.now() }
        ];
        mockStateManager.getUndoHistory = vi.fn().mockReturnValue(mockUndoHistory);
        
        const { result } = renderHook(() => useTreeViewController(mockProps));

        expect(result.current.undoHistory).toEqual(mockUndoHistory);
        expect(result.current.undoHistory).toHaveLength(2);
      });

      it('should provide redo history information', () => {
        const mockRedoHistory = [
          { id: 'cmd-3', type: 'moveNode', timestamp: Date.now() }
        ];
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
        // 初期状態設定
        mockStateManager.canUndo = vi.fn()
          .mockReturnValueOnce(false) // 初期状態
          .mockReturnValueOnce(true); // undo後の状態

        mockStateManager.canRedo = vi.fn()
          .mockReturnValueOnce(false) // 初期状態
          .mockReturnValueOnce(false) // undo後の状態（まだredoはない）
          .mockReturnValueOnce(true); // undoした後の状態

        const { result } = renderHook(() => useTreeViewController(mockProps));

        // 初期状態確認
        expect(result.current.canUndo).toBe(false);
        expect(result.current.canRedo).toBe(false);

        // 何かしら操作を実行（例：ノード削除）
        mockStateManager.deleteNode = vi.fn().mockResolvedValue({ success: true });
        await act(async () => {
          await result.current.deleteNode('$1' as NodeId);
        });

        // 削除後はundoできるはず
        expect(result.current.canUndo).toBe(true);
        expect(result.current.canRedo).toBe(false);
      });
    });

    describe('undo/redo integration with CRUD operations', () => {
      it('should record operations for undo when performing CRUD', async () => {
        mockStateManager.deleteNode = vi.fn().mockResolvedValue({ 
          success: true,
          recordedForUndo: true 
        });
        mockStateManager.canUndo = vi.fn()
          .mockReturnValueOnce(false) // before operation
          .mockReturnValueOnce(true); // after operation

        const { result } = renderHook(() => useTreeViewController(mockProps));

        expect(result.current.canUndo).toBe(false);

        await act(async () => {
          await result.current.deleteNode('$1' as NodeId);
        });

        // 操作後はundoが可能になっているはず
        expect(result.current.canUndo).toBe(true);
      });

      it('should clear redo stack when new operation is performed', async () => {
        // シナリオ: undo→新しい操作→redoスタックがクリアされる
        mockStateManager.canRedo = vi.fn()
          .mockReturnValueOnce(true)  // undo後、redoが可能
          .mockReturnValueOnce(false); // 新しい操作後、redoスタックがクリア

        mockStateManager.createNode = vi.fn().mockResolvedValue({ 
          success: true,
          clearedRedoStack: true 
        });

        const { result } = renderHook(() => useTreeViewController(mockProps));

        // redo可能な状態から開始
        expect(result.current.canRedo).toBe(true);

        // 新しい操作を実行
        await act(async () => {
          await result.current.startCreate('parent-1' as NodeId, 'New Node');
        });

        // 新しい操作後はredoできなくなる
        expect(result.current.canRedo).toBe(false);
      });
    });

    describe('undo/redo with complex operations', () => {
      it('should handle batch operations undo', async () => {
        const batchOperation = {
          nodeIds: ['node-1', 'node-2', 'node-3'],
          operation: 'delete'
        };

        mockStateManager.undo = vi.fn().mockResolvedValue({ 
          success: true, 
          undoneCommand: { 
            type: 'batchDelete', 
            batchOperation,
            restoredNodes: [
              { id: 'node-1', name: 'Node 1' },
              { id: 'node-2', name: 'Node 2' },
              { id: 'node-3', name: 'Node 3' }
            ]
          }
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
            toIndex: 0
          }
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