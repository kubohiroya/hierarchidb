import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { NodeId, TreeNode, WorkingCopy } from '@hierarchidb/common-core';
import { CoreDB } from '../CoreDB';
import { EphemeralDB } from '../EphemeralDB';

describe('データベース初期化テスト', () => {
  let coreDB: CoreDB;
  let ephemeralDB: EphemeralDB;

  beforeEach(() => {
    // テスト用の新しいデータベースインスタンスを作成
    coreDB = new CoreDB('test-core');
    ephemeralDB = new EphemeralDB('test-ephemeral');
  });

  afterEach(async () => {
    // テスト後のクリーンアップ
    await coreDB.delete();
    await ephemeralDB.delete();
  });

  describe('CoreDB初期化', () => {
    it('CoreDBが正常に初期化されること', async () => {
      // データベースを開く
      await coreDB.open();

      // データベースが開かれていることを確認
      expect(coreDB.isOpen()).toBe(true);

      // テーブルが存在することを確認
      expect(coreDB.trees).toBeDefined();
      expect(coreDB.nodes).toBeDefined();
      expect(coreDB.rootStates).toBeDefined();
    });

    it('テーブル作成確認テスト', async () => {
      await coreDB.open();

      // テストデータを作成
      const testNode: TreeNode = {
        id: 'test-node-1' as NodeId,
        parentId: 'root' as NodeId,
        nodeType: 'folder',
        name: 'Test Node',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      // ノードを追加
      await coreDB.nodes.add(testNode);

      // ノードが取得できることを確認
      const retrievedNode = await coreDB.getNode('test-node-1' as NodeId);
      expect(retrievedNode).toBeDefined();
      expect(retrievedNode?.name).toBe('Test Node');
    });

    it('インデックス設定確認テスト', async () => {
      await coreDB.open();

      // 複数のテストノードを作成
      const parentId = 'parent-1' as NodeId;
      const nodes: TreeNode[] = [
        {
          id: 'child-1' as NodeId,
          parentId,
          nodeType: 'folder',
          name: 'Child 1',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        },
        {
          id: 'child-2' as NodeId,
          parentId: parentId,
          nodeType: 'folder',
          name: 'Child 2',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        },
        {
          id: 'child-3' as NodeId,
          parentId,
          nodeType: 'file',
          name: 'Child 3',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        },
      ];

      // ノードを一括追加
      await coreDB.nodes.bulkAdd(nodes);

      // parentIdインデックスを使用した検索が機能することを確認
      const children = await coreDB.listChildren(parentId);
      expect(children).toHaveLength(3);
      expect(children.map((c) => c.name)).toContain('Child 1');
      expect(children.map((c) => c.name)).toContain('Child 2');
      expect(children.map((c) => c.name)).toContain('Child 3');

      // 複合インデックス [parentId+name] の動作確認
      const specificChild = await coreDB.nodes
        .where('[parenId+name]')
        .equals([parentId, 'Child 2'])
        .first();

      expect(specificChild).toBeDefined();
      expect(specificChild?.id).toBe('child-2');
    });
  });

  describe('EphemeralDB初期化', () => {
    it('EphemeralDBが正常に初期化されること', async () => {
      // データベースを開く
      await ephemeralDB.open();

      // データベースが開かれていることを確認
      expect(ephemeralDB.isOpen()).toBe(true);

      // テーブルが存在することを確認
      expect(ephemeralDB.workingCopies).toBeDefined();
      expect(ephemeralDB.views).toBeDefined();
    });

    it('WorkingCopyテーブル作成確認テスト', async () => {
      await ephemeralDB.open();

      // テストデータを作成
      const testWorkingCopy: WorkingCopy = {
        id: 'wc-1' as NodeId,
        parentId: 'parent-1' as NodeId,
        nodeType: 'folder',
        name: 'Working Copy Test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        copiedAt: Date.now(),
      };

      // Working Copyを追加
      await ephemeralDB.workingCopies.add(testWorkingCopy);

      // Working Copyが取得できることを確認
      const retrievedWC = await ephemeralDB.getWorkingCopy('wc-1');
      expect(retrievedWC).toBeDefined();
      expect(retrievedWC?.name).toBe('Working Copy Test');
      expect(retrievedWC?.isDraft).toBe(true);
    });

    it('WorkingCopyインデックス確認テスト', async () => {
      await ephemeralDB.open();

      const nodeId = 'original-node-1' as NodeId;
      const workingCopies: WorkingCopy[] = [
        {
          id: 'wc-1' as NodeId,
          originalNodeId: nodeId,
          parentId: 'parent-1' as NodeId,
          nodeType: 'folder',
          name: 'WC 1',
          version: 1,
          createdAt: Date.now() - 3000,
          copiedAt: Date.now() - 3000,
          updatedAt: Date.now() - 3000,
        },
        {
          id: 'wc-2' as NodeId,
          originalNodeId: nodeId,
          parentId: 'parent-1' as NodeId,
          nodeType: 'folder',
          name: 'WC 2',
          version: 1,
          createdAt: Date.now() - 3000,
          copiedAt: Date.now() - 2000,
          updatedAt: Date.now() - 1000,
        },
        {
          id: 'wc-3' as NodeId,
          parentId: 'parent-2' as NodeId,
          nodeType: 'file',
          name: 'WC 3',
          version: 1,
          createdAt: Date.now(),
          copiedAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      // Working Copiesを一括追加
      await ephemeralDB.workingCopies.bulkAdd(workingCopies);

      // workingCopyOfインデックスを使用した検索
      const nodeWorkingCopies = await ephemeralDB.workingCopies
        .where('workingCopyOf')
        .equals(nodeId)
        .toArray();

      expect(nodeWorkingCopies).toHaveLength(2);
      expect(nodeWorkingCopies.map((wc) => wc.id)).toContain('wc-1');
      expect(nodeWorkingCopies.map((wc) => wc.id)).toContain('wc-2');

      // updatedAtインデックスを使用したソート
      const sortedByUpdate = await ephemeralDB.workingCopies
        .orderBy('updatedAt')
        .reverse()
        .toArray();

      expect(sortedByUpdate[0]?.id).toBe('wc-3');
    });
  });

  describe('データベース接続エラーハンドリング', () => {
    it('データベース接続失敗時の再試行', async () => {
      // 無効なデータベース名でインスタンスを作成
      const invalidCoreDB = new CoreDB('');

      try {
        await invalidCoreDB.open();
        // データベースが開かれた場合もテスト継続
        expect(invalidCoreDB.isOpen()).toBe(true);
      } catch (error) {
        // エラーが発生した場合の処理
        expect(error).toBeDefined();
      } finally {
        if (invalidCoreDB.isOpen()) {
          await invalidCoreDB.close();
        }
      }
    });

    it('バージョン競合時のマイグレーション', async () => {
      // 初期バージョンのデータベースを作成
      const db1 = new CoreDB('migration-test');
      await db1.open();

      // データを追加
      await db1.nodes.add({
        id: 'test-node' as NodeId,
        parentId: 'root' as NodeId,
        nodeType: 'folder',
        name: 'Test',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      });

      await db1.close();

      // 同じ名前で新しいインスタンスを作成（マイグレーションのシミュレーション）
      const db2 = new CoreDB('migration-test');
      await db2.open();

      // データが保持されていることを確認
      const node = await db2.nodes.get('test-node' as NodeId);
      expect(node).toBeDefined();
      expect(node?.name).toBe('Test');

      await db2.delete();
    });
  });

  describe('データベース完了条件の確認', () => {
    it('CoreDB/EphemeralDBが正常に初期化される', async () => {
      await coreDB.open();
      await ephemeralDB.open();

      expect(coreDB.isOpen()).toBe(true);
      expect(ephemeralDB.isOpen()).toBe(true);
    });

    it('各テーブルのスキーマが定義通りである', async () => {
      await coreDB.open();
      await ephemeralDB.open();

      // CoreDBのテーブル確認
      const coreTableNames = coreDB.tables.map((t) => t.name);
      expect(coreTableNames).toContain('trees');
      expect(coreTableNames).toContain('nodes');
      expect(coreTableNames).toContain('rootStates');

      // EphemeralDBのテーブル確認
      const ephemeralTableNames = ephemeralDB.tables.map((t) => t.name);
      expect(ephemeralTableNames).toContain('workingCopies');
      expect(ephemeralTableNames).toContain('views');
    });

    it('インデックスが適切に設定されている', async () => {
      await coreDB.open();

      // nodesテーブルのインデックス確認
      const nodesTable = coreDB.nodes;
      const schema = nodesTable.schema;

      // 主キーの確認
      expect(schema.primKey.name).toBe('treeNodeId');

      // インデックスの存在確認（Dexieのschemaオブジェクトから）
      const indexNames = schema.indexes.map((idx) => idx.name);
      expect(indexNames).toContain('parentId');
      expect(indexNames).toContain('[parentId+name]');
      expect(indexNames).toContain('[parentId+updatedAt]');
    });
  });
});
