/**
 * @file BatchSessionMigration.test.ts
 * @description ERIA-Cartograph移植に向けたバッチセッション実装テスト (TDD Red Phase)
 *
 * テスト目的：
 * - HierarchiDBのWorker通信仕様に適合したBatchSessionManager実装の検証
 * - 4段階バッチ処理パイプライン（Download→Simplify1→Simplify2→VectorTiles）の動作確認
 * - Comlink RPCを使用したWorker間通信の実装検証
 *
 * 前提条件：
 * - BatchSessionManagerがWorkerAPIパターンに準拠して実装済み
 * - 各段階のWorker（DownloadWorker、Simplify1Worker、Simplify2Worker、VectorTileWorker）が実装済み
 * - バッチタスク管理とプログレス追跡機能が実装済み
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NodeId, TreeNodeId } from '@hierarchidb/core';
import { createNodeId } from '@hierarchidb/core';
import { BatchSessionManager } from '../../services/batch/BatchSessionManager';
import type { BatchConfig } from '../../types/BatchConfig';
import type { BatchTaskLike } from '../../types/BatchTaskLike';
import type { BatchProgressEvent } from '../../types/BatchProgressEvent';

describe('BatchSession Migration Tests', () => {
  let batchSessionManager: BatchSessionManager;
  let mockNodeId: NodeId;
  let mockTreeNodeId: TreeNodeId;
  let mockBatchConfig: BatchConfig;

  beforeEach(() => {
    // Given: テスト用の設定を準備
    mockNodeId = createNodeId('test-shape-plugin-node');
    mockTreeNodeId = 'tree-node-123' as TreeNodeId;

    mockBatchConfig = {
      corsProxyBaseURL: 'https://test-proxy.example.com',
      dataSource: 'naturalearth',
      download: {
        concurrentDownloads: 2,
        deleteOnComplete: false,
      },
      simplify1: {
        concurrentProcesses: 2,
        enableFeatureFiltering: true,
        featureAreaThreshold: 0.5,
        minVertexCountForAreaFilter: 25,
        aspectRatioThreshold: 5,
        featureFilterMethod: 'hybrid',
        hybridFilterConfig: {
          quickRejectThreshold: 0.1,
          regularShapeMinRatio: 0.5,
          regularShapeMaxRatio: 2.0,
          simpleShapeVertexThreshold: 50,
          elongatedShapeCorrectionFactor: 0.8,
        },
        deleteOnComplete: false,
      },
      simplify2: {
        concurrentProcesses: 2,
        quantize: 1e4,
        simplify: 0.01,
        tolerance: 0.1,
        enablePerFeatureSimplification: true,
        deleteOnComplete: false,
      },
      vectorTiles: {
        concurrentProcesses: 2,
        maxZoom: 6,
        tileCountThresholdForZoomStop: 5000,
      },
    };

    batchSessionManager = new BatchSessionManager();
  });

  describe('バッチセッション開始テスト', () => {
    it('バッチ処理セッションが正常に開始される', async () => {
      // Given: バッチ処理開始に必要なパラメータ
      const countries = ['JPN', 'KOR'];
      const adminLevels = [0, 1, 2];

      // When: バッチセッションを開始
      const sessionId = await batchSessionManager.startBatchSession(
        mockTreeNodeId,
        mockBatchConfig,
        countries,
        adminLevels
      );

      // Then: セッションが正常に開始される
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(0);

      // セッション状態が初期化される
      const sessionStatus = await batchSessionManager.getSessionStatus(sessionId);
      expect(sessionStatus).toBeDefined();
      expect(sessionStatus.stage).toBe('download');
      expect(sessionStatus.totalTasks).toBeGreaterThan(0);
      expect(sessionStatus.completedTasks).toBe(0);
    });

    it('複数の国と管理レベルでバッチタスクが正常に生成される', async () => {
      // Given: 複数の国と管理レベル
      const countries = ['USA', 'CAN', 'MEX'];
      const adminLevels = [0, 1];

      // When: バッチセッションを開始
      const sessionId = await batchSessionManager.startBatchSession(
        mockTreeNodeId,
        mockBatchConfig,
        countries,
        adminLevels
      );

      // Then: 適切な数のバッチタスクが生成される
      const tasks = await batchSessionManager.getBatchTasks(sessionId);
      expect(tasks).toBeDefined();
      expect(tasks.length).toBe(countries.length * adminLevels.length); // 3 countries × 2 levels = 6 tasks

      // 各タスクが適切に設定される
      tasks.forEach((task) => {
        expect(task.treeNodeId).toBe(mockTreeNodeId);
        expect(task.stage).toBe('download');
        expect(task.status).toBe('pending');
        expect(countries).toContain(task.country);
        expect(adminLevels).toContain(task.adminLevel);
      });
    });

    it('バッチセッション状態が正常に追跡される', async () => {
      // Given: 開始されたバッチセッション
      const sessionId = await batchSessionManager.startBatchSession(
        mockTreeNodeId,
        mockBatchConfig,
        ['JPN'],
        [0]
      );

      // When: セッション状態を取得
      const initialStatus = await batchSessionManager.getSessionStatus(sessionId);

      // Then: 初期状態が正しく設定される
      expect(initialStatus.sessionId).toBe(sessionId);
      expect(initialStatus.nodeId).toBe(mockTreeNodeId);
      expect(initialStatus.stage).toBe('download');
      expect(initialStatus.totalTasks).toBe(1);
      expect(initialStatus.completedTasks).toBe(0);
      expect(initialStatus.failedTasks).toBe(0);
      expect(initialStatus.progress).toBe(0);
      expect(initialStatus.isCompleted).toBe(false);
    });
  });

  describe('4段階パイプライン実行テスト', () => {
    it('Download段階が正常に実行される', async () => {
      // Given: 開始されたバッチセッション
      const sessionId = await batchSessionManager.startBatchSession(
        mockTreeNodeId,
        mockBatchConfig,
        ['JPN'],
        [0]
      );

      // When: Download段階を実行
      const downloadResult = await batchSessionManager.executeDownloadStage(sessionId);

      // Then: Download段階が成功する
      expect(downloadResult).toBeDefined();
      expect(downloadResult.success).toBe(true);
      expect(downloadResult.processedTasks).toBeGreaterThan(0);
      expect(downloadResult.failedTasks).toBe(0);

      // セッション状態が更新される
      const status = await batchSessionManager.getSessionStatus(sessionId);
      expect(status.stage).toBe('simplify1');
    });

    it('Simplify1段階が正常に実行される', async () => {
      // Given: Download段階完了済みのセッション
      const sessionId = await batchSessionManager.startBatchSession(
        mockTreeNodeId,
        mockBatchConfig,
        ['JPN'],
        [0]
      );
      await batchSessionManager.executeDownloadStage(sessionId);

      // When: Simplify1段階を実行
      const simplify1Result = await batchSessionManager.executeSimplify1Stage(sessionId);

      // Then: Simplify1段階が成功する
      expect(simplify1Result).toBeDefined();
      expect(simplify1Result.success).toBe(true);
      expect(simplify1Result.processedFeatures).toBeGreaterThan(0);
      expect(simplify1Result.filteredFeatures).toBeGreaterThanOrEqual(0);

      // セッション状態が更新される
      const status = await batchSessionManager.getSessionStatus(sessionId);
      expect(status.stage).toBe('simplify2');
    });

    it('Simplify2段階が正常に実行される', async () => {
      // Given: Simplify1段階完了済みのセッション
      const sessionId = await batchSessionManager.startBatchSession(
        mockTreeNodeId,
        mockBatchConfig,
        ['JPN'],
        [0]
      );
      await batchSessionManager.executeDownloadStage(sessionId);
      await batchSessionManager.executeSimplify1Stage(sessionId);

      // When: Simplify2段階を実行
      const simplify2Result = await batchSessionManager.executeSimplify2Stage(sessionId);

      // Then: Simplify2段階が成功する
      expect(simplify2Result).toBeDefined();
      expect(simplify2Result.success).toBe(true);
      expect(simplify2Result.processedTiles).toBeGreaterThan(0);
      expect(simplify2Result.simplificationRatio).toBeGreaterThan(0);
      expect(simplify2Result.simplificationRatio).toBeLessThanOrEqual(1);

      // セッション状態が更新される
      const status = await batchSessionManager.getSessionStatus(sessionId);
      expect(status.stage).toBe('vectorTiles');
    });

    it('VectorTiles段階が正常に実行される', async () => {
      // Given: Simplify2段階完了済みのセッション
      const sessionId = await batchSessionManager.startBatchSession(
        mockTreeNodeId,
        mockBatchConfig,
        ['JPN'],
        [0]
      );
      await batchSessionManager.executeDownloadStage(sessionId);
      await batchSessionManager.executeSimplify1Stage(sessionId);
      await batchSessionManager.executeSimplify2Stage(sessionId);

      // When: VectorTiles段階を実行
      const vectorTilesResult = await batchSessionManager.executeVectorTilesStage(sessionId);

      // Then: VectorTiles段階が成功し、セッションが完了する
      expect(vectorTilesResult).toBeDefined();
      expect(vectorTilesResult.success).toBe(true);
      expect(vectorTilesResult.generatedTiles).toBeGreaterThan(0);
      expect(vectorTilesResult.maxZoomLevel).toBeGreaterThanOrEqual(0);
      expect(vectorTilesResult.maxZoomLevel).toBeLessThanOrEqual(
        mockBatchConfig.vectorTiles.maxZoom
      );

      // セッション状態が完了になる
      const finalStatus = await batchSessionManager.getSessionStatus(sessionId);
      expect(finalStatus.isCompleted).toBe(true);
      expect(finalStatus.progress).toBe(100);
    });
  });

  describe('プログレス追跡テスト', () => {
    it('バッチ処理プログレスが正常に追跡される', async () => {
      // Given: プログレス追跡用のコールバック
      const progressEvents: BatchProgressEvent[] = [];
      const progressCallback = (event: BatchProgressEvent) => {
        progressEvents.push(event);
      };

      // When: プログレス追跡付きでバッチセッションを実行
      const sessionId = await batchSessionManager.startBatchSession(
        mockTreeNodeId,
        mockBatchConfig,
        ['JPN'],
        [0],
        progressCallback
      );

      await batchSessionManager.executeFullPipeline(sessionId);

      // Then: プログレスイベントが適切に発生する
      expect(progressEvents.length).toBeGreaterThan(0);

      // 各段階のプログレスが記録される
      const downloadProgress = progressEvents.find((e) => e.stage === 'download');
      const simplify1Progress = progressEvents.find((e) => e.stage === 'simplify1');
      const simplify2Progress = progressEvents.find((e) => e.stage === 'simplify2');
      const vectorTilesProgress = progressEvents.find((e) => e.stage === 'vectorTiles');

      expect(downloadProgress).toBeDefined();
      expect(simplify1Progress).toBeDefined();
      expect(simplify2Progress).toBeDefined();
      expect(vectorTilesProgress).toBeDefined();
    });
  });

  describe('エラーハンドリングテスト', () => {
    it('Workerの失敗が適切にハンドリングされる', async () => {
      // Given: Worker失敗を引き起こす不正な設定
      const invalidConfig = {
        ...mockBatchConfig,
        corsProxyBaseURL: 'invalid-url',
      };

      // When & Then: Worker失敗時にエラーが適切にハンドリングされる
      await expect(
        batchSessionManager.startBatchSession(
          mockTreeNodeId,
          invalidConfig,
          ['INVALID_COUNTRY'],
          [0]
        )
      ).rejects.toThrow('Invalid batch configuration');
    });

    it('中断されたセッションが適切にクリーンアップされる', async () => {
      // Given: 実行中のバッチセッション
      const sessionId = await batchSessionManager.startBatchSession(
        mockTreeNodeId,
        mockBatchConfig,
        ['JPN'],
        [0]
      );

      // When: セッションを中断
      await batchSessionManager.abortSession(sessionId);

      // Then: セッションが適切にクリーンアップされる
      const status = await batchSessionManager.getSessionStatus(sessionId);
      expect(status.isAborted).toBe(true);
      expect(status.isCompleted).toBe(false);
    });
  });

  describe('境界値テスト', () => {
    it('タスク数ゼロのセッションが適切に処理される', async () => {
      // Given: 空の国リスト
      const emptyCountries: string[] = [];
      const adminLevels = [0];

      // When & Then: 空のセッションでエラーが発生する
      await expect(
        batchSessionManager.startBatchSession(
          mockTreeNodeId,
          mockBatchConfig,
          emptyCountries,
          adminLevels
        )
      ).rejects.toThrow('No tasks to process');
    });

    it('大量のタスクを持つセッションが正常に処理される', async () => {
      // Given: 多数の国と管理レベル（実用上の最大値）
      const manyCountries = ['USA', 'CAN', 'MEX', 'BRA', 'ARG', 'PER', 'COL', 'VEN'];
      const manyAdminLevels = [0, 1, 2, 3];

      // When: 大量のタスクでセッションを開始
      const sessionId = await batchSessionManager.startBatchSession(
        mockTreeNodeId,
        mockBatchConfig,
        manyCountries,
        manyAdminLevels
      );

      // Then: セッションが正常に開始される
      expect(sessionId).toBeDefined();

      const status = await batchSessionManager.getSessionStatus(sessionId);
      expect(status.totalTasks).toBe(manyCountries.length * manyAdminLevels.length); // 8 × 4 = 32 tasks
    });
  });
});
