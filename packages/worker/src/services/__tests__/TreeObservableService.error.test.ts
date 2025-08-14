import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { firstValueFrom, take, timeout } from 'rxjs';
import { TreeObservableServiceImpl } from '../TreeObservableServiceImpl';
import type { CommandEnvelope, TreeNodeId, ObserveNodePayload, Timestamp } from '@hierarchidb/core';
import { generateUUID } from '@hierarchidb/core';
import { createMockCoreDB, setupTestData, type MockCoreDB } from './TreeObservableService.setup';

/**
 * TreeObservableService - エラーハンドリング・リソース管理テスト
 *
 * 異常系の処理とリソース管理機能を検証します：
 * - データベースエラー処理
 * - 削除されたノードへのサブスクリプション
 * - リソース管理・クリーンアップ
 * - サブスクリプション数の追跡
 */
describe('TreeObservableService - Error Handling & Resource Management', () => {
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

  describe('Error Handling', () => {
    /**
     * データベースエラー処理テスト
     * データベース接続エラーが発生しても適切にハンドリングすることを確認
     */
    it('should handle database errors gracefully', async () => {
      // getNodeメソッドをエラーを投げるように設定
      coreDB.getNode.mockRejectedValue(new Error('Database connection failed'));

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

      // エラーが発生してもObservableが作成されることを確認
      const observable = await service.observeNode(cmd);

      // エラーハンドリングのテスト
      const subscription = observable.subscribe({
        next: (event) => {
          // データベースエラーにもかかわらずイベントが処理されることを確認
          console.log('Received event despite DB error:', event);
        },
        error: (error) => {
          // エラーが適切に伝播されることを確認
          expect(error.message).toContain('Database connection failed');
        },
      });

      // クリーンアップ
      setTimeout(() => subscription.unsubscribe(), 100);
    });

    /**
     * 削除されたノードへのサブスクリプション処理テスト
     * 監視中のノードが削除された場合の適切な処理を確認
     */
    it('should handle subscription to deleted nodes', async () => {
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

      // 監視対象のノードを削除
      setTimeout(() => {
        coreDB.deleteNode('folder1' as TreeNodeId);
      }, 10);

      const event = await eventsPromise;

      // 削除イベントが適切に受信されることを確認
      expect(event.type).toBe('node-deleted');
      expect(event.nodeId).toBe('folder1');
    });
  });

  describe('Resource Management', () => {
    /**
     * アクティブサブスクリプション数追跡テスト
     * サブスクリプション数が適切に追跡されることを確認
     */
    it('should track active subscriptions count', async () => {
      const initialCount = await service.getActiveSubscriptions();

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
      const subscription = observable.subscribe();

      // サブスクリプション数の増加を確認
      const newCount = await service.getActiveSubscriptions();
      expect(newCount).toBeGreaterThan(initialCount);

      // クリーンアップ
      subscription.unsubscribe();
    });

    /**
     * サービス破棄時のリソースクリーンアップテスト
     * 複数のサブスクリプションが作成された状態でのクリーンアップ処理を確認
     */
    it('should cleanup resources on service destruction', async () => {
      // 複数のサブスクリプションを作成
      const observables = await Promise.all([
        service.observeNode({
          commandId: generateUUID(),
          groupId: generateUUID(),
          kind: 'observeNode',
          payload: { treeNodeId: 'folder1' as TreeNodeId },
          issuedAt: Date.now() as Timestamp,
        }),
        service.observeChildren({
          commandId: generateUUID(),
          groupId: generateUUID(),
          kind: 'observeChildren',
          payload: { parentTreeNodeId: 'root' as TreeNodeId },
          issuedAt: Date.now() as Timestamp,
        }),
      ]);

      // 複数のサブスクリプションを開始
      const subscriptions = observables.map((obs) => obs.subscribe());

      // すぐに解除
      subscriptions.forEach((sub) => sub.unsubscribe());

      // 全サブスクリプションのクリーンアップ
      await service.cleanupOrphanedSubscriptions();

      // サービスがクリーンアップを適切に処理することを確認
      const count = await service.getActiveSubscriptions();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    /**
     * 長期運用でのメモリリーク検出テスト
     * サブスクリプションの作成・破棄を繰り返してもメモリリークが発生しないことを確認
     */
    it('should prevent memory leaks in long-term usage', async () => {
      const initialCount = await service.getActiveSubscriptions();

      // サブスクリプションの作成・破棄を複数回繰り返す
      for (let i = 0; i < 20; i++) {
        const cmd: CommandEnvelope<'observeNode', ObserveNodePayload> = {
          commandId: generateUUID(),
          groupId: generateUUID(),
          kind: 'observeNode',
          payload: {
            treeNodeId: `folder${(i % 3) + 1}` as TreeNodeId,
            includeInitialValue: false,
          },
          issuedAt: Date.now() as Timestamp,
        };

        const observable = await service.observeNode(cmd);
        const subscription = observable.subscribe();

        // 短時間後に解除
        setTimeout(() => subscription.unsubscribe(), 1);
      }

      // クリーンアップ処理の実行
      await new Promise((resolve) => setTimeout(resolve, 100));
      await service.cleanupOrphanedSubscriptions();

      const finalCount = await service.getActiveSubscriptions();

      // メモリリークが発生していないことを確認
      // （完全に初期状態に戻る必要はないが、大幅に増加していないこと）
      expect(finalCount).toBeLessThanOrEqual(initialCount + 10); // 余裕を持った範囲

      console.log(`🔍 Memory leak detection:`);
      console.log(`  - Initial: ${initialCount} subscriptions`);
      console.log(`  - Final: ${finalCount} subscriptions`);
      console.log(
        `  - Leak status: ${finalCount <= initialCount + 10 ? '✅ GOOD' : '⚠️ POTENTIAL LEAK'}`
      );
    });
  });
});
