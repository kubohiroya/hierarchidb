import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { firstValueFrom, take, timeout } from 'rxjs';
import { TreeObservableServiceImpl } from '../TreeObservableServiceImpl';
import type {
  CommandEnvelope,
  TreeNodeId,
  ObserveChildrenPayload,
  Timestamp,
} from '@hierarchidb/core';
import { generateUUID } from '@hierarchidb/core';
import {
  createMockCoreDB,
  setupTestData,
  createTestNode,
  type MockCoreDB,
} from './TreeObservableService.setup';

/**
 * TreeObservableService - 子ノード監視機能のテスト
 *
 * observeChildren メソッドの各種機能をテストします：
 * - 初期スナップショットの取得
 * - 子ノード追加イベントの受信
 * - 子ノード削除イベントの受信
 * - ノードタイプフィルタリング
 */
describe('TreeObservableService - Children Observation', () => {
  let service: TreeObservableServiceImpl;
  let coreDB: MockCoreDB;

  beforeEach(() => {
    coreDB = createMockCoreDB();
    setupTestData(coreDB);
    service = new TreeObservableServiceImpl(coreDB as any);
  });

  afterEach(() => {
    service.cleanupOrphanedSubscriptions();
  });

  describe('observeChildren', () => {
    /**
     * 初期スナップショット取得機能のテスト
     * includeInitialSnapshot=trueで現在の子ノード一覧が取得できることを確認
     */
    it('should emit initial snapshot when includeInitialSnapshot is true', async () => {
      const cmd: CommandEnvelope<'observeChildren', ObserveChildrenPayload> = {
        commandId: generateUUID(),
        groupId: generateUUID(),
        kind: 'observeChildren',
        payload: {
          parentTreeNodeId: 'root' as TreeNodeId,
          includeInitialSnapshot: true,
        },
        issuedAt: Date.now() as Timestamp,
      };

      const observable = await service.observeChildren(cmd);
      const firstEvent = await firstValueFrom(observable.pipe(take(1), timeout(1000)));

      expect(firstEvent.type).toBe('children-changed');
      expect(firstEvent.nodeId).toBe('root');
      expect(firstEvent.affectedChildren).toHaveLength(3); // folder1, folder2, folder3
    });

    /**
     * 子ノード追加イベント受信テスト
     * 新しい子ノードが追加された際にイベントが配信されることを確認
     */
    it('should emit events when children are added', async () => {
      const cmd: CommandEnvelope<'observeChildren', ObserveChildrenPayload> = {
        commandId: generateUUID(),
        groupId: generateUUID(),
        kind: 'observeChildren',
        payload: {
          parentTreeNodeId: 'folder3' as TreeNodeId,
          includeInitialSnapshot: false,
        },
        issuedAt: Date.now() as Timestamp,
      };

      const observable = await service.observeChildren(cmd);

      // 監視開始
      const eventsPromise = firstValueFrom(observable.pipe(take(1), timeout(1000)));

      // 子ノードを追加
      setTimeout(() => {
        const newChild = createTestNode('new-child', 'folder3', 'New Child');
        coreDB.createNode(newChild);
      }, 10);

      const event = await eventsPromise;

      expect(event.type).toBe('node-created');
      expect(event.parentId).toBe('folder3');
      expect(event.node?.name).toBe('New Child');
    });

    /**
     * 子ノード削除イベント受信テスト
     * 子ノードが削除された際にイベントが配信されることを確認
     */
    it('should emit events when children are removed', async () => {
      const cmd: CommandEnvelope<'observeChildren', ObserveChildrenPayload> = {
        commandId: generateUUID(),
        groupId: generateUUID(),
        kind: 'observeChildren',
        payload: {
          parentTreeNodeId: 'folder1' as TreeNodeId,
          includeInitialSnapshot: false,
        },
        issuedAt: Date.now() as Timestamp,
      };

      const observable = await service.observeChildren(cmd);

      // 監視開始
      const eventsPromise = firstValueFrom(observable.pipe(take(1), timeout(1000)));

      // 子ノードを削除
      setTimeout(() => {
        coreDB.deleteNode('file2' as TreeNodeId);
      }, 10);

      const event = await eventsPromise;

      expect(event.type).toBe('node-deleted');
      expect(event.nodeId).toBe('file2');
    });

    /**
     * ノードタイプフィルタリング機能のテスト
     * 指定されたノードタイプのみがフィルタリングされることを確認
     */
    it('should filter children by type when filter is provided', async () => {
      const cmd: CommandEnvelope<'observeChildren', ObserveChildrenPayload> = {
        commandId: generateUUID(),
        groupId: generateUUID(),
        kind: 'observeChildren',
        payload: {
          parentTreeNodeId: 'folder1' as TreeNodeId,
          includeInitialSnapshot: true,
          filter: {
            nodeTypes: ['file'],
          },
        },
        issuedAt: Date.now() as Timestamp,
      };

      const observable = await service.observeChildren(cmd);
      const firstEvent = await firstValueFrom(observable.pipe(take(1), timeout(1000)));

      expect(firstEvent.type).toBe('children-changed');
      // folder1の子: subfolder1（フォルダ）とfile2.txt（ファイル）のうち、ファイルのみ
      expect(firstEvent.affectedChildren).toHaveLength(1); // file2.txt のみ
    });
  });
});
