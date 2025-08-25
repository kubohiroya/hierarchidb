/**
 * Worker層直接呼び出しテスト
 *
 * Comlink経由ではなく、Worker内部のサービスを直接テストします。
 * これにより、Worker層の動作を高速かつ確実にテストできます。
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { WorkerAPIImpl } from '../WorkerAPIImpl';
import { CoreDB } from '../db/CoreDB';
import { EphemeralDB } from '../db/EphemeralDB';
import { TreeMutationService } from '../services/TreeMutationService';
import { TreeSubscribeService } from '../services/TreeSubscribeService';
import { CommandProcessor } from '../command/CommandProcessor';
import { NodeLifecycleManager } from '../lifecycle/NodeLifecycleManager';
import { SimpleNodeTypeRegistry } from '../registry/SimpleNodeTypeRegistry';
import type { NodeId, Tree, TreeNode } from '@hierarchidb/common-core';

describe('Worker層直接呼び出しテスト', () => {
  let coreDB: CoreDB;
  let ephemeralDB: EphemeralDB;
  let mutationService: TreeMutationService;
  let observableService: TreeSubscribeService;
  let commandProcessor: CommandProcessor;

  beforeEach(async () => {
    // データベースを直接初期化
    coreDB = new CoreDB('test-core-db');
    ephemeralDB = new EphemeralDB('test-ephemeral-db');

    await coreDB.open();
    await ephemeralDB.open();

    // サービスを直接初期化 - 改善された依存性注入パターンを使用
    const dbAdapter = {
      async deleteNode(nodeId: NodeId) {
        return await coreDB.deleteNode(nodeId);
      },
      async createNode(node: TreeNode) {
        await coreDB.createNode(node);
      },
    };
    commandProcessor = new CommandProcessor(dbAdapter);
    const registry = new SimpleNodeTypeRegistry();
    const lifecycleManager = new NodeLifecycleManager(registry, coreDB, ephemeralDB);
    mutationService = new TreeMutationService(
      coreDB,
      ephemeralDB,
      commandProcessor,
      lifecycleManager
    );
    observableService = new TreeSubscribeService(coreDB);
  });

  afterEach(async () => {
    // クリーンアップ
    coreDB.close();
    ephemeralDB.close();
  });

  describe('フォルダ作成の内部動作', () => {
    it('Working Copyの作成と管理', async () => {
      // Working Copyを直接作成
      const workingCopyId = 'wc-test-001';
      const parentId = 'root' as NodeId;

      // EphemeralDBにWorking Copyを保存
      await ephemeralDB.workingCopies.add({
        id: workingCopyId as NodeId,
        parentId: parentId,
        nodeType: 'folder',
        name: 'Test Folder',
        description: 'Test Description',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        copiedAt: Date.now(),
      });

      // Working Copyを取得
      const workingCopy = await ephemeralDB.workingCopies.get(workingCopyId);
      expect(workingCopy).toBeDefined();
      expect(workingCopy?.name).toBe('Test Folder');
      expect(workingCopy?.nodeType).toBe('folder');
    });

    it('Working CopyからCoreDBへのコミット', async () => {
      // Working Copyを作成
      const workingCopyId = 'wc-test-002';
      const parentId = 'root' as NodeId;
      const newNodeId = 'node-001' as NodeId;

      // Working Copyを準備
      await ephemeralDB.workingCopies.add({
        id: workingCopyId as NodeId,
        parentId: parentId,
        nodeType: 'folder',
        name: 'Committed Folder',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        copiedAt: Date.now(),
      });

      // コミット処理をシミュレート
      const now = Date.now();
      const newNode: TreeNode = {
        id: newNodeId,
        parentId: parentId,
        nodeType: 'folder',
        name: 'Committed Folder',
        createdAt: now,
        updatedAt: now,
        version: 1,
      };

      // CoreDBに保存
      await coreDB.nodes.add(newNode);

      // Working Copyを削除
      await ephemeralDB.workingCopies.delete(workingCopyId);

      // 確認
      const savedNode = await coreDB.nodes.get(newNodeId);
      expect(savedNode).toBeDefined();
      expect(savedNode?.name).toBe('Committed Folder');

      const deletedWC = await ephemeralDB.workingCopies.get(workingCopyId);
      expect(deletedWC).toBeUndefined();
    });
  });

  describe('CommandProcessorの動作', () => {
    it('コマンドの記録とUndo/Redo', async () => {
      // コマンドを作成
      const command1 = commandProcessor.createEnvelope('createNode', {
        nodeId: 'node-001' as NodeId,
        name: 'Folder 1',
      });

      const command2 = commandProcessor.createEnvelope('createNode', {
        nodeId: 'node-002' as NodeId,
        name: 'Folder 2',
      });

      // コマンドを処理（実際の処理はモック）
      await commandProcessor.processCommand(command1);
      await commandProcessor.processCommand(command2);

      // Undo/Redoスタックの確認
      expect(commandProcessor.canUndo()).toBe(true);
      expect(commandProcessor.getUndoStackSize()).toBe(2);
      expect(commandProcessor.canRedo()).toBe(false);

      // Undo実行
      const undoResult = await commandProcessor.undo();
      expect(undoResult.success).toBe(true);
      expect(commandProcessor.getUndoStackSize()).toBe(1);
      expect(commandProcessor.canRedo()).toBe(true);

      // Redo実行
      const redoResult = await commandProcessor.redo();
      expect(redoResult.success).toBe(true);
      expect(commandProcessor.getUndoStackSize()).toBe(2);
      expect(commandProcessor.canRedo()).toBe(false);
    });
  });

  describe('Observable Serviceの動作', () => {
    it('ノード変更の検出', async () => {
      // 初期ノードを作成
      const nodeId = 'node-obs-001' as NodeId;
      const initialNode: TreeNode = {
        id: nodeId,
        parentId: 'root' as NodeId,
        nodeType: 'folder',
        name: 'Initial Name',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
      };

      await coreDB.nodes.add(initialNode);

      // 変更を記録するための配列
      const changes: any[] = [];

      // Observable購読（実際のAPI呼び出し形式に修正）
      const observable = await observableService.subscribeNode({
        kind: 'subscribeNode',
        payload: { nodeId: nodeId },
        commandId: 'cmd-obs-001',
        groupId: 'test-obs-group',
        issuedAt: Date.now(),
      });

      const subscription = observable.subscribe({
        next: (change) => {
          console.log('Received change:', change);
          changes.push(change);
        },
        error: (err) => console.error('Observable error:', err),
      });

      // ノードを更新（changeSubjectイベントが自動発火するupdateNodeメソッドを使用）
      const updatedNode = await coreDB.nodes.get(nodeId);
      if (updatedNode) {
        await coreDB.updateNode({
          ...updatedNode,
          name: 'Updated Name',
          version: 2,
        });
      }

      // 変更通知は自動的にcoreDB.changeSubjectから発行される
      // 少し待機して変更イベントが処理されるのを待つ

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(changes).toHaveLength(1);
      expect(changes[0].type).toBe('update');
      expect(changes[0].nodeId).toBe(nodeId);

      // クリーンアップ
      subscription.unsubscribe();
    });
  });

  describe('トランザクション処理', () => {
    it('複数の操作をトランザクションで実行', async () => {
      // Dexieのトランザクションを使用
      await coreDB.transaction('rw', coreDB.nodes, async () => {
        // 複数のノードを一括作成
        const nodes: TreeNode[] = [
          {
            id: 'tx-node-001' as NodeId,
            parentId: 'root' as NodeId,
            nodeType: 'folder',
            name: 'TX Folder 1',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
          },
          {
            id: 'tx-node-002' as NodeId,
            parentId: 'root' as NodeId,
            nodeType: 'folder',
            name: 'TX Folder 2',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
          },
        ];

        await coreDB.nodes.bulkAdd(nodes);
      });

      // トランザクション完了後の確認
      const node1 = await coreDB.nodes.get('tx-node-001');
      const node2 = await coreDB.nodes.get('tx-node-002');

      expect(node1).toBeDefined();
      expect(node2).toBeDefined();
      expect(node1?.name).toBe('TX Folder 1');
      expect(node2?.name).toBe('TX Folder 2');
    });

    it('エラー時のロールバック', async () => {
      let errorThrown = false;

      try {
        await coreDB.transaction('rw', coreDB.nodes, async () => {
          // 最初のノードを追加
          await coreDB.nodes.add({
            id: 'rollback-001' as NodeId,
            parentId: 'root' as NodeId,
            nodeType: 'folder',
            name: 'Should Rollback',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            version: 1,
          });

          // エラーを強制的に発生させる
          throw new Error('Simulated error');
        });
      } catch (error) {
        errorThrown = true;
      }

      // エラーが発生したことを確認
      expect(errorThrown).toBe(true);

      // ロールバックされたことを確認
      const node = await coreDB.nodes.get('rollback-001');
      expect(node).toBeUndefined();
    });
  });

  describe('パフォーマンステスト', () => {
    it('大量ノードの一括作成性能', async () => {
      const startTime = Date.now();
      const nodeCount = 1000;
      const nodes: TreeNode[] = [];

      // 1000個のノードを準備
      for (let i = 0; i < nodeCount; i++) {
        nodes.push({
          id: `perf-node-${i}` as NodeId,
          parentId: 'root' as NodeId,
          nodeType: 'folder',
          name: `Performance Test Folder ${i}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        });
      }

      // 一括追加
      await coreDB.nodes.bulkAdd(nodes);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 1000ノードの作成が1秒以内であることを確認
      expect(duration).toBeLessThan(1000);

      // ノード数の確認
      const count = await coreDB.nodes.count();
      expect(count).toBeGreaterThanOrEqual(nodeCount);
    });

    it('インデックスを使用した高速検索', async () => {
      // テストデータを準備
      const testNodes: TreeNode[] = [];
      for (let i = 0; i < 100; i++) {
        testNodes.push({
          id: `search-node-${i}` as NodeId,
          parentId: i % 10 === 0 ? ('root' as NodeId) : (`search-node-${i - 1}` as NodeId),
          nodeType: 'folder',
          name: `Search Test ${i}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          version: 1,
        });
      }

      await coreDB.nodes.bulkAdd(testNodes);

      // インデックスを使用した検索
      const startTime = Date.now();

      // 特定の親ノードの子を検索
      const children = await coreDB.nodes.where('parentId').equals('root').toArray();

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 高速検索（100ms以内）
      expect(duration).toBeLessThan(100);
      expect(children.length).toBe(10); // root直下は10個
    });
  });
});
