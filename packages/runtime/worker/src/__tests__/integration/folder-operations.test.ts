/**
 * フォルダ操作の統合テスト
 *
 * UI層を介さずに、Worker APIを直接テストします。
 * これにより、E2Eテストよりも高速で安定したテストが可能です。
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { WorkerAPIImpl } from '../../WorkerAPIImpl';
import type { NodeId, TreeId, Tree } from '@hierarchidb/common-core';

describe.skip('フォルダ操作の統合テスト (needs update to new API)', () => {
  let api: WorkerAPIImpl;
  let testTreeId: string;

  beforeEach(async () => {
    // Worker APIを直接インスタンス化（UIなし）
    api = new WorkerAPIImpl('test-folder-db');
    await api.initialize();

    // テスト用のツリーを作成
    const tree: Tree = {
      id: 'test-tree' as TreeId,
      name: 'Test Tree',
      superRootId: 'super-root' as NodeId,
      rootId: 'root' as NodeId,
      trashRootId: 'trash' as NodeId,
    };

    testTreeId = tree.id;

    // 必要な基本ノードを作成
    const coreDB = (api as any).coreDB;
    await coreDB.createNode({
      id: 'root' as NodeId,
      parentId: 'super-root' as NodeId,
      nodeType: 'folder',
      name: 'Root',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    });
  });

  afterEach(async () => {
    // クリーンアップ
    await api.shutdown();
  });

  describe('フォルダ作成', () => {
    it('ルートレベルにフォルダを作成できる', async () => {
      // MutationAPIを使用してフォルダ作成
      const mutationAPI = api.getMutationAPI();
      const result = await mutationAPI.createNode({
        nodeType: 'folder',
        treeId: testTreeId as TreeId,
        parentId: 'root' as NodeId,
        name: 'Test Folder',
        description: 'A test folder',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.nodeId).toBeDefined();
      }
    });

    it('子フォルダを作成できる', async () => {
      // 親フォルダを作成（Orchestrated API使用）
      const parentResult = await api.createFolder({
        treeId: testTreeId as TreeId,
        parentId: 'root' as NodeId,
        name: 'Parent Folder',
      });

      expect(parentResult.success).toBe(true);
      if (parentResult.success) {
        expect(parentResult.nodeId).toBeDefined();
        // 子フォルダを作成
        const childResult = await api.createFolder({
          treeId: testTreeId as TreeId,
          parentId: parentResult.nodeId,
          name: 'Child Folder',
        });

        if (childResult.success) {
          expect(childResult.nodeId).toBeDefined();
        }
      }
    });

    it('空の名前でフォルダ作成に失敗する', async () => {
      // Orchestrated API使用 - 空の名前でテスト
      const result = await api.createFolder({
        treeId: testTreeId as TreeId,
        parentId: 'root' as NodeId,
        name: '', // 空の名前
      });

      // バリデーションエラーを期待
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('name');
      }
    });
  });

  describe('フォルダ名称更新', () => {
    it('フォルダ名を更新できる', async () => {
      // フォルダを作成（Orchestrated API使用）
      const createResult = await api.createFolder({
        treeId: testTreeId as TreeId,
        parentId: 'root' as NodeId,
        name: 'Original Name',
      });

      expect(createResult.success).toBe(true);
      if (createResult.success) {
        expect(createResult.nodeId).toBeDefined();
        // 名前を更新（Orchestrated API使用）
        const updateResult = await api.updateFolderName({
          nodeId: createResult.nodeId,
          name: 'Updated Name',
        });

        expect(updateResult.success).toBe(true);
      }
    });
  });

  describe('フォルダ移動', () => {
    it('フォルダを別の親に移動できる', async () => {
      // 2つの親フォルダを作成
      const parent1 = await createFolder(api, testTreeId, 'Parent 1');
      const parent2 = await createFolder(api, testTreeId, 'Parent 2');

      // Parent 1の子フォルダを作成
      const child = await createFolder(api, testTreeId, 'Child', parent1);

      // デバッグ: 作成された値の型を確認
      console.log('child type:', typeof child, 'value:', child);
      console.log('parent2 type:', typeof parent2, 'value:', parent2);

      // まず移動前にchildノードが取得できることを確認
      // 直接CoreDBからアクセスしてみる
      const coreDB = (api as any).coreDB;
      const directChild = await coreDB.getNode(child);
      console.log('directChild from coreDB:', directChild);

      const childBeforeMove = await api.getNode(child);
      console.log('childBeforeMove:', childBeforeMove);
      expect(childBeforeMove).toBeDefined();
      expect(childBeforeMove?.parentId).toBe(parent1);

      // ChildをParent 2に移動（Orchestrated API使用）
      const moveResult = await api.moveFolder({
        nodeIds: [child],
        toParentId: parent2,
      });

      expect(moveResult.success).toBe(true);

      // 移動後の確認
      const childNode = await api.getNode(child);
      expect(childNode?.parentId).toBe(parent2);
    });

    it('循環参照を防ぐ', async () => {
      // 親子関係のフォルダを作成
      const parent = await createFolder(api, testTreeId, 'Parent');
      const child = await createFolder(api, testTreeId, 'Child', parent);

      // 親を子の中に移動しようとする（循環参照）
      const moveResult = await api.moveFolder({
        nodeIds: [parent],
        toParentId: child,
      });

      // エラーを期待
      expect(moveResult.success).toBe(false);
      if (!moveResult.success) {
        expect(moveResult.error).toContain('Circular');
      }
    });
  });

  describe('ゴミ箱操作', () => {
    it('フォルダをゴミ箱に移動できる', async () => {
      const folderId = await createFolder(api, testTreeId, 'To Delete');

      // ゴミ箱に移動（Orchestrated API使用）
      const trashResult = await api.moveToTrashFolder([folderId]);

      expect(trashResult.success).toBe(true);

      // ノードの状態を確認
      const node = await api.getNode(folderId);
      expect(node?.isRemoved).toBe(true);
    });

    it('ゴミ箱から復元できる', async () => {
      const folderId = await createFolder(api, testTreeId, 'To Restore');

      // ゴミ箱に移動（Orchestrated API使用）
      await api.moveToTrashFolder([folderId]);

      // 復元（Orchestrated API使用）
      const restoreResult = await api.recoverFromTrashFolder({
        nodeIds: [folderId],
      });

      expect(restoreResult.success).toBe(true);

      // ノードの状態を確認
      const node = await api.getNode(folderId);
      expect(node?.isRemoved).toBe(false);
    });

    it('ゴミ箱から完全削除できる', async () => {
      const folderId = await createFolder(api, testTreeId, 'To Delete Permanently');

      // ゴミ箱に移動（Orchestrated API使用）
      await api.moveToTrashFolder([folderId]);

      // 完全削除（Orchestrated API使用）
      const deleteResult = await api.removeFolder([folderId]);

      expect(deleteResult.success).toBe(true);

      // ノードが存在しないことを確認
      const node = await api.getNode(folderId);
      expect(node).toBeUndefined();
    });
  });

  describe('複製とコピー', () => {
    it('フォルダを複製できる', async () => {
      const originalId = await createFolder(api, testTreeId, 'Original');

      // 複製（Orchestrated API使用）
      const duplicateResult = await api.duplicateNodesFolder({
        nodeIds: [originalId],
      });

      expect(duplicateResult.success).toBe(true);
      if (duplicateResult.success) {
        expect(duplicateResult.nodeIds).toHaveLength(1);

        // 複製されたノードを確認
        const duplicatedNodeId = duplicateResult.nodeIds[0];
        if (duplicatedNodeId) {
          const duplicatedNode = await api.getNode(duplicatedNodeId);
          expect(duplicatedNode?.name).toContain('Original');
          expect(duplicatedNode?.name).toContain('Copy');
        }
      }
    });

    it('フォルダをコピー&ペーストできる', async () => {
      const sourceId = await createFolder(api, testTreeId, 'Source');
      const targetParent = await createFolder(api, testTreeId, 'Target Parent');

      // コピー（Orchestrated API使用）
      const copyResult = await api.copyNodesFolder({
        nodeIds: [sourceId],
      });

      expect(copyResult.success).toBe(true);

      // ペースト（Orchestrated API使用）
      if (!copyResult.success) {
        throw new Error('Copy operation failed');
      }

      const pasteResult = await api.pasteNodesFolder({
        targetParentId: targetParent,
        clipboardData: copyResult.clipboardData,
      });

      expect(pasteResult.success).toBe(true);
      if (pasteResult.success && pasteResult.nodeIds) {
        expect(pasteResult.nodeIds).toHaveLength(1);

        // ペーストされたノードを確認
        const pastedNodeId = pasteResult.nodeIds[0];
        if (pastedNodeId) {
          const pastedNode = await api.getNode(pastedNodeId);
          expect(pastedNode?.parentId).toBe(targetParent);
        }
      }
    });
  });

  describe('Undo/Redo', () => {
    it('フォルダ作成を取り消せる', async () => {
      const folderId = await createFolder(api, testTreeId, 'To Undo');

      // Undo（Orchestrated API使用）
      const undoResult = await api.undo();

      expect(undoResult.success).toBe(true);

      // フォルダが削除されたことを確認
      const node = await api.getNode(folderId);
      expect(node).toBeUndefined();
    });

    it('取り消した操作をやり直せる', async () => {
      const folderId = await createFolder(api, testTreeId, 'To Redo');

      // Undo（Orchestrated API使用）
      await api.undo();

      // Redo（Orchestrated API使用）
      const redoResult = await api.redo();

      expect(redoResult.success).toBe(true);

      // フォルダが復元されたことを確認
      const node = await api.getNode(folderId);
      expect(node).toBeDefined();
      expect(node?.name).toBe('To Redo');
    });
  });

  describe('パフォーマンステスト', () => {
    it('100個のフォルダを作成してもパフォーマンスが維持される', async () => {
      const startTime = Date.now();
      const folderIds: NodeId[] = [];

      // 100個のフォルダを作成
      for (let i = 0; i < 100; i++) {
        const folderId = await createFolder(api, testTreeId, `Folder ${i}`);
        folderIds.push(folderId);
      }

      const creationTime = Date.now() - startTime;

      // 作成時間が5秒以内であることを確認
      expect(creationTime).toBeLessThan(5000);

      // すべてのフォルダが作成されたことを確認
      expect(folderIds).toHaveLength(100);

      // 一括削除のパフォーマンステスト
      const deleteStartTime = Date.now();
      await api.moveToTrashFolder(folderIds);
      const deleteTime = Date.now() - deleteStartTime;

      // 削除時間が2秒以内であることを確認
      expect(deleteTime).toBeLessThan(2000);
    });
  });
});

// ヘルパー関数（API経由でのフォルダ作成 - Undo/Redoテスト対応）
async function createFolder(
  api: WorkerAPIImpl,
  treeId: string,
  name: string,
  parentId: NodeId = 'root' as NodeId
): Promise<NodeId> {
  // API経由でフォルダを作成（CommandProcessorによる記録も含む）
  const result = await api.createFolder({
    treeId: treeId as TreeId,
    parentId: parentId,
    name: name,
  });

  if (!result.success) {
    throw new Error(
      `Failed to create folder: ${'error' in result ? result.error : 'Unknown error'}`
    );
  }

  if (!result.nodeId) {
    throw new Error('Failed to create folder: No nodeId returned');
  }

  return result.nodeId;
}

function generateNodeId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
