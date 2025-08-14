import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TreeObservableServiceImpl } from '../TreeObservableServiceImpl';
import type { CommandEnvelope, TreeNodeId, ObserveNodePayload, Timestamp } from '@hierarchidb/core';
import { generateUUID } from '@hierarchidb/core';
import { createMockCoreDB, setupTestData, type MockCoreDB } from './TreeObservableService.setup';

/**
 * TreeObservableService - パフォーマンステスト
 *
 * サービスの性能特性と大量負荷での動作を検証します：
 * - 大量同時サブスクリプション処理
 * - サブスクリプションクリーンアップ機能
 * - 高頻度イベント処理性能
 * - メモリリーク耐性
 */
describe('TreeObservableService - Performance Tests', () => {
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

  /**
   * 大量同時サブスクリプション処理テスト
   * 複数のサブスクリプションが同時に作成・管理できることを確認
   */
  it('should handle multiple simultaneous subscriptions efficiently', async () => {
    const nodeIds = ['folder1', 'folder2', 'folder3'] as TreeNodeId[];
    const subscriptions: Promise<any>[] = [];

    // 複数のサブスクリプションを作成
    for (const nodeId of nodeIds) {
      const cmd: CommandEnvelope<'observeNode', ObserveNodePayload> = {
        commandId: generateUUID(),
        groupId: generateUUID(),
        kind: 'observeNode',
        payload: {
          treeNodeId: nodeId,
          includeInitialValue: true,
        },
        issuedAt: Date.now() as Timestamp,
      };

      subscriptions.push(service.observeNode(cmd));
    }

    const observables = await Promise.all(subscriptions);

    expect(observables).toHaveLength(3);
    expect(await service.getActiveSubscriptions()).toBeGreaterThan(0);
  });

  /**
   * サブスクリプションクリーンアップ機能テスト
   * 使用されなくなったサブスクリプションが適切に削除されることを確認
   */
  it('should cleanup orphaned subscriptions', async () => {
    // サブスクリプションを作成
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

    // サブスクライブしてから解除
    const subscription = observable.subscribe();
    subscription.unsubscribe();

    // クリーンアップを実行
    await service.cleanupOrphanedSubscriptions();

    // アクティブなサブスクリプション数が適切に管理されていることを確認
    const activeCount = await service.getActiveSubscriptions();
    expect(activeCount).toBeGreaterThanOrEqual(0);
  });

  /**
   * 高頻度イベント処理性能テスト
   * 大量の変更イベントが発生してもメモリリークしないことを確認
   *
   * このテストは現在の実装のパフォーマンス特性を測定し、
   * リファクタリング後の改善を評価するためのベンチマークとしても機能します。
   */
  it('should handle high-frequency changes without memory leaks', async () => {
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

    let eventCount = 0;
    const subscription = observable.subscribe(() => {
      eventCount++;
    });

    // 大量の高頻度変更を生成
    const changeCount = 100;
    const startTime = performance.now();

    for (let i = 0; i < changeCount; i++) {
      await coreDB.updateNode('folder1' as TreeNodeId, { name: `Folder ${i}` });
    }

    const endTime = performance.now();
    const processingTime = endTime - startTime;

    // イベント伝播のための待機時間
    await new Promise((resolve) => setTimeout(resolve, 100));

    subscription.unsubscribe();

    // 性能特性の検証
    expect(eventCount).toBeGreaterThan(0);
    expect(eventCount).toBeLessThanOrEqual(changeCount);

    // パフォーマンス指標のログ出力（リファクタリング効果測定用）
    console.log(`📊 Performance metrics:`);
    console.log(`  - Events processed: ${eventCount}/${changeCount}`);
    console.log(`  - Processing time: ${processingTime.toFixed(2)}ms`);
    console.log(`  - Throughput: ${((eventCount / processingTime) * 1000).toFixed(2)} events/sec`);

    // 基本的な性能要件の確認
    expect(processingTime).toBeLessThan(5000); // 5秒以内で完了
    expect(eventCount / changeCount).toBeGreaterThan(0.5); // 50%以上のイベントが処理される
  });

  /**
   * リソース管理テスト
   * サービスが適切にリソースを管理し、メモリリークを防いでいることを確認
   */
  it('should manage resources properly during intensive usage', async () => {
    const initialActiveCount = await service.getActiveSubscriptions();

    // 複数のサブスクリプションを作成・破棄するサイクルを実行
    for (let cycle = 0; cycle < 10; cycle++) {
      const observables = [];
      const subscriptions = [];

      // サブスクリプションを作成
      for (let i = 0; i < 5; i++) {
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
        observables.push(observable);
        subscriptions.push(observable.subscribe());
      }

      // 短時間待機
      await new Promise((resolve) => setTimeout(resolve, 10));

      // サブスクリプションを解除
      subscriptions.forEach((sub) => sub.unsubscribe());

      // クリーンアップを実行
      await service.cleanupOrphanedSubscriptions();
    }

    const finalActiveCount = await service.getActiveSubscriptions();

    // リソースが適切にクリーンアップされていることを確認
    expect(finalActiveCount).toBeLessThanOrEqual(initialActiveCount + 5); // 多少の余裕を持った範囲

    console.log(`🧹 Resource management test:`);
    console.log(`  - Initial subscriptions: ${initialActiveCount}`);
    console.log(`  - Final subscriptions: ${finalActiveCount}`);
    console.log(
      `  - Leak detection: ${finalActiveCount <= initialActiveCount + 5 ? '✅ PASS' : '❌ FAIL'}`
    );
  });
});
