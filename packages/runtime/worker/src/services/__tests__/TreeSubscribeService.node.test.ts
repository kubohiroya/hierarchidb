import type { CommandEnvelope, ObserveNodePayload, Timestamp, NodeId } from '@hierarchidb/common-core';
import { generateNodeId } from '@hierarchidb/common-core';
import { firstValueFrom, take, timeout } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TreeSubscribeService } from '../TreeSubscribeService';
import { createMockCoreDB, type MockCoreDB, setupTestData } from './TreeSubscribeService.setup';

/**
 * TreeSubscribeService - 単一ノード購読機能のテスト
 *
 * subscribeNode メソッドの各種機能をテストします：
 * - 初期値の取得
 * - ノード更新イベントの受信
 * - ノード削除イベントの受信
 * - 存在しないノードの処理
 */
describe('TreeSubscribeService - Node Subscription', () => {
  let service: TreeSubscribeService;
  let coreDB: MockCoreDB;

  beforeEach(() => {
    coreDB = createMockCoreDB();
    setupTestData(coreDB);
    service = new TreeSubscribeService(coreDB as any);
  });

  afterEach(() => {
    service.cleanupInactiveSubscriptions();
  });

  describe('subscribeNode', () => {
    /**
     * 初期値取得機能のテスト
     * includeInitialValue=trueで初期状態が取得できることを確認
     */
    it('should emit initial value when includeInitialValue is true', async () => {
      const cmd: CommandEnvelope<'subscribeNode', ObserveNodePayload> = {
        commandId: generateNodeId(),
        groupId: generateNodeId(),
        kind: 'subscribeNode',
        payload: {
          nodeId: 'folder1' as NodeId,
          includeInitialValue: true,
        },
        issuedAt: Date.now() as Timestamp,
      };

      const observable = await service.subscribeNode(cmd);
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
      const cmd: CommandEnvelope<'subscribeNode', ObserveNodePayload> = {
        commandId: generateNodeId(),
        groupId: generateNodeId(),
        kind: 'subscribeNode',
        payload: {
          nodeId: 'folder1' as NodeId,
          includeInitialValue: false,
        },
        issuedAt: Date.now() as Timestamp,
      };

      const observable = await service.subscribeNode(cmd);

      // 監視開始
      const eventsPromise = firstValueFrom(observable.pipe(take(1), timeout(1000)));

      // 変更をトリガー
      setTimeout(() => {
        coreDB.updateNode('folder1' as NodeId, { name: 'Updated Folder 1' });
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
      const cmd: CommandEnvelope<'subscribeNode', ObserveNodePayload> = {
        commandId: generateNodeId(),
        groupId: generateNodeId(),
        kind: 'subscribeNode',
        payload: {
          nodeId: 'folder3' as NodeId,
          includeInitialValue: false,
        },
        issuedAt: Date.now() as Timestamp,
      };

      const observable = await service.subscribeNode(cmd);

      // 監視開始
      const eventsPromise = firstValueFrom(observable.pipe(take(1), timeout(1000)));

      // 削除をトリガー
      setTimeout(() => {
        coreDB.deleteNode('folder3' as NodeId);
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
      const cmd: CommandEnvelope<'subscribeNode', ObserveNodePayload> = {
        commandId: generateNodeId(),
        groupId: generateNodeId(),
        kind: 'subscribeNode',
        payload: {
          nodeId: 'non-existent' as NodeId,
          includeInitialValue: true,
        },
        issuedAt: Date.now() as Timestamp,
      };

      const observable = await service.subscribeNode(cmd);

      // 存在しないノードでもイベントが発行されることを確認
      const firstEvent = await firstValueFrom(observable.pipe(take(1), timeout(1000)));

      expect(firstEvent.type).toBe('node-updated');
      expect(firstEvent.nodeId).toBe('non-existent');
      expect(firstEvent.node).toBeUndefined();
    });
  });
});
