import type { CommandEnvelope, ObserveNodePayload, Timestamp, TreeNodeId } from '@hierarchidb/core';
import { generateUUID } from '@hierarchidb/core';
import { firstValueFrom, take, timeout } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TreeObservableServiceImpl } from '../TreeObservableServiceImpl';
import { createMockCoreDB, type MockCoreDB, setupTestData } from './TreeObservableService.setup';

/**
 * TreeObservableService - 単一ノード監視機能のテスト
 *
 * observeNode メソッドの各種機能をテストします：
 * - 初期値の取得
 * - ノード更新イベントの受信
 * - ノード削除イベントの受信
 * - 存在しないノードの処理
 */
describe('TreeObservableService - Node Observation', () => {
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

  describe('observeNode', () => {
    /**
     * 初期値取得機能のテスト
     * includeInitialValue=trueで初期状態が取得できることを確認
     */
    it('should emit initial value when includeInitialValue is true', async () => {
      const cmd: CommandEnvelope<'observeNode', ObserveNodePayload> = {
        commandId: generateUUID(),
        groupId: generateUUID(),
        kind: 'observeNode',
        payload: {
          treeNodeId: 'folder1' as TreeNodeId,
          includeInitialValue: true,
        },
        issuedAt: Date.now() as Timestamp,
      };

      const observable = await service.observeNode(cmd);
      const firstEvent = await firstValueFrom(observable.pipe(take(1), timeout(1000)));

      expect(firstEvent.type).toBe('node-updated');
      expect(firstEvent.nodeId).toBe('folder1');
      expect(firstEvent.node?.name).toBe('Folder 1');
    });

    /**
     * ノード更新イベント受信テスト
     * ノードが更新された際にイベントが配信されることを確認
     */
    it('should emit change events when node is updated', async () => {
      const cmd: CommandEnvelope<'observeNode', ObserveNodePayload> = {
        commandId: generateUUID(),
        groupId: generateUUID(),
        kind: 'observeNode',
        payload: {
          treeNodeId: 'folder1' as TreeNodeId,
          includeInitialValue: false,
        },
        issuedAt: Date.now() as Timestamp,
      };

      const observable = await service.observeNode(cmd);

      // 監視開始
      const eventsPromise = firstValueFrom(observable.pipe(take(1), timeout(1000)));

      // 変更をトリガー
      setTimeout(() => {
        coreDB.updateNode('folder1' as TreeNodeId, { name: 'Updated Folder 1' });
      }, 10);

      const event = await eventsPromise;

      expect(event.type).toBe('node-updated');
      expect(event.nodeId).toBe('folder1');
      expect(event.node?.name).toBe('Updated Folder 1');
      expect(event.previousNode?.name).toBe('Folder 1');
    });

    /**
     * ノード削除イベント受信テスト
     * ノードが削除された際にイベントが配信されることを確認
     */
    it('should emit delete events when node is deleted', async () => {
      const cmd: CommandEnvelope<'observeNode', ObserveNodePayload> = {
        commandId: generateUUID(),
        groupId: generateUUID(),
        kind: 'observeNode',
        payload: {
          treeNodeId: 'folder3' as TreeNodeId,
          includeInitialValue: false,
        },
        issuedAt: Date.now() as Timestamp,
      };

      const observable = await service.observeNode(cmd);

      // 監視開始
      const eventsPromise = firstValueFrom(observable.pipe(take(1), timeout(1000)));

      // 削除をトリガー
      setTimeout(() => {
        coreDB.deleteNode('folder3' as TreeNodeId);
      }, 10);

      const event = await eventsPromise;

      expect(event.type).toBe('node-deleted');
      expect(event.nodeId).toBe('folder3');
      expect(event.previousNode?.name).toBe('Empty Folder');
    });

    /**
     * 存在しないノードの処理テスト
     * 存在しないノードに対してもエラーを起こさず適切にハンドリングすることを確認
     */
    it('should handle non-existent nodes gracefully', async () => {
      const cmd: CommandEnvelope<'observeNode', ObserveNodePayload> = {
        commandId: generateUUID(),
        groupId: generateUUID(),
        kind: 'observeNode',
        payload: {
          treeNodeId: 'non-existent' as TreeNodeId,
          includeInitialValue: true,
        },
        issuedAt: Date.now() as Timestamp,
      };

      const observable = await service.observeNode(cmd);

      // 存在しないノードでもイベントが発行されることを確認
      const firstEvent = await firstValueFrom(observable.pipe(take(1), timeout(1000)));

      expect(firstEvent.type).toBe('node-updated');
      expect(firstEvent.nodeId).toBe('non-existent');
      expect(firstEvent.node).toBeUndefined();
    });
  });
});
