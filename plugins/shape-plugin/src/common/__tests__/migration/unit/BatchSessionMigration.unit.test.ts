/**
  * @file BatchSessionMigration.test.ts
 * @description ERIA-Cartograph (TDD Red Phase)
   * - HierarchiDBWorkerBatchSessionManager
 * - 4DownloadExtract1Extract2VectorTiles
 * - Comlink RPCWorker
   * - BatchSessionManagerWorkerAPI
 * - WorkerDownloadWorkerExtract1WorkerExtract2WorkerVectorTileWorker
 * -
  */

import { beforeEach, describe, expect, it } from 'vitest';
import type { NodeId } from '@hierarchidb/common-types';
import { BatchSessionManager } from '../../services/BatchSessionManager.js';
import type { BatchConfig } from '../../types/BatchConfig.js';
import type { BatchProgressEvent } from '../../types/BatchProgressEvent.js';

type TreeNodeId = NodeId;

describe('BatchSession Migration Tests', () => {
  let batchSessionManager: BatchSessionManager;
  let mockNodeId: NodeId;
  let mockTreeNodeId: TreeNodeId;
  let mockBatchConfig: BatchConfig;

  beforeEach(() => {
    //  Given:
    mockNodeId = 'test-shape-plugin-node' as NodeId;
    mockTreeNodeId = 'console-node-123' as TreeNodeId;

    mockBatchConfig = {
      dataSource: 'naturalearth',
      download: {
        concurrentDownloads: 2,
        deleteOnComplete: false,
      },
      extract1: {
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
      extract2: {
        concurrentProcesses: 2,
        quantize: 1e4,
        extract: 0.01,
        tolerance: 0.1,
        enablePerFeatureExtraction: true,
        deleteOnComplete: false,
      },
      vectorTiles: {
        concurrentProcesses: 2,
        minZoom: 0,
        maxZoom: 6,
      },
    };

    batchSessionManager = new BatchSessionManager();
  });

  describe('バッチセッション開始テスト', () => {
    it('バッチ処理セッションが正常に開始される', async () => {
      //  Given:
      const countries = ['JPN', 'KOR'];
      const adminLevels = [0, 1, 2];

      //  When:
      const sessionId = await batchSessionManager.startBatchSession(
        mockTreeNodeId,
        mockBatchConfig,
        countries,
        adminLevels,
      );

      //  Then:
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(0);

      const sessionStatus = await batchSessionManager.getSessionStatus(sessionId);
      expect(sessionStatus).toBeDefined();
      expect(sessionStatus.stage).toBe('download');
      expect(sessionStatus.totalTasks).toBeGreaterThan(0);
      expect(sessionStatus.completedTasks).toBe(0);
    });

    it('複数の国と管理レベルでバッチタスクが正常に生成される', async () => {
      //  Given:
      const countries = ['USA', 'CAN', 'MEX'];
      const adminLevels = [0, 1];

      //  When:
      const sessionId = await batchSessionManager.startBatchSession(
        mockTreeNodeId,
        mockBatchConfig,
        countries,
        adminLevels,
      );

      //  Then:
      const tasks = await batchSessionManager.getBatchTasks(sessionId);
      expect(tasks).toBeDefined();
      expect(tasks.length).toBe(countries.length * adminLevels.length); //  3 countries 2 levels = 6 tasks

      tasks.forEach((task) => {
        expect(task.treeNodeId).toBe(mockTreeNodeId);
        expect(task.stage).toBe('download');
        expect(task.status).toBe('pending');
        expect(countries).toContain(task.country);
        expect(adminLevels).toContain(task.adminLevel);
      });
    });

    it('バッチセッション状態が正常に追跡される', async () => {
      //  Given:
      const sessionId = await batchSessionManager.startBatchSession(
        mockTreeNodeId,
        mockBatchConfig,
        ['JPN'],
        [0],
      );

      //  When:
      const initialStatus = await batchSessionManager.getSessionStatus(sessionId);

      //  Then:
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
      //  Given:
      const sessionId = await batchSessionManager.startBatchSession(
        mockTreeNodeId,
        mockBatchConfig,
        ['JPN'],
        [0],
      );

      //  When: Download
      const downloadResult = await batchSessionManager.executeDownloadStage(sessionId);

      //  Then: Download
      expect(downloadResult).toBeDefined();
      expect(downloadResult.success).toBe(true);
      expect(downloadResult.processedTasks).toBeGreaterThan(0);
      expect(downloadResult.failedTasks).toBe(0);

      const status = await batchSessionManager.getSessionStatus(sessionId);
      expect(status.stage).toBe('extract1');
    });

    it('Extract1段階が正常に実行される', async () => {
      //  Given: Download
      const sessionId = await batchSessionManager.startBatchSession(
        mockTreeNodeId,
        mockBatchConfig,
        ['JPN'],
        [0],
      );
      await batchSessionManager.executeDownloadStage(sessionId);

      //  When: Extract1
      const extract1Result = await batchSessionManager.executeExtract1Stage(sessionId);

      //  Then: Extract1
      expect(extract1Result).toBeDefined();
      expect(extract1Result.success).toBe(true);
      expect(extract1Result.processedFeatures).toBeGreaterThan(0);
      expect(extract1Result.filteredFeatures).toBeGreaterThanOrEqual(0);

      const status = await batchSessionManager.getSessionStatus(sessionId);
      expect(status.stage).toBe('extract2');
    });

    it('Extract2段階が正常に実行される', async () => {
      //  Given: Extract1
      const sessionId = await batchSessionManager.startBatchSession(
        mockTreeNodeId,
        mockBatchConfig,
        ['JPN'],
        [0],
      );
      await batchSessionManager.executeDownloadStage(sessionId);
      await batchSessionManager.executeExtract1Stage(sessionId);

      //  When: Extract2
      const extract2Result = await batchSessionManager.executeExtract2Stage(sessionId);

      //  Then: Extract2
      expect(extract2Result).toBeDefined();
      expect(extract2Result.success).toBe(true);
      expect(extract2Result.processedTiles).toBeGreaterThan(0);
      expect(extract2Result.extractionRatio).toBeGreaterThan(0);
      expect(extract2Result.extractionRatio).toBeLessThanOrEqual(1);

      const status = await batchSessionManager.getSessionStatus(sessionId);
      expect(status.stage).toBe('vectorTiles');
    });

    it('VectorTiles段階が正常に実行される', async () => {
      //  Given: Extract2
      const sessionId = await batchSessionManager.startBatchSession(
        mockTreeNodeId,
        mockBatchConfig,
        ['JPN'],
        [0],
      );
      await batchSessionManager.executeDownloadStage(sessionId);
      await batchSessionManager.executeExtract1Stage(sessionId);
      await batchSessionManager.executeExtract2Stage(sessionId);

      //  When: VectorTiles
      const vectorTilesResult = await batchSessionManager.executeVectorTilesStage(sessionId);

      //  Then: VectorTiles
      expect(vectorTilesResult).toBeDefined();
      expect(vectorTilesResult.success).toBe(true);
      expect(vectorTilesResult.generatedTiles).toBeGreaterThan(0);
      expect(vectorTilesResult.maxZoomLevel).toBeGreaterThanOrEqual(0);
      expect(vectorTilesResult.maxZoomLevel).toBeLessThanOrEqual(
        mockBatchConfig.vectorTiles.maxZoom,
      );

      const finalStatus = await batchSessionManager.getSessionStatus(sessionId);
      expect(finalStatus.isCompleted).toBe(true);
      expect(finalStatus.progress).toBe(100);
    });
  });

  describe('プログレス追跡テスト', () => {
    it('バッチ処理プログレスが正常に追跡される', async () => {
      //  Given:
      const progressEvents: BatchProgressEvent[] = [];
      const progressCallback = (event: BatchProgressEvent) => {
        progressEvents.push(event);
      };

      //  When:
      const sessionId = await batchSessionManager.startBatchSession(
        mockTreeNodeId,
        mockBatchConfig,
        ['JPN'],
        [0],
        progressCallback,
      );

      await batchSessionManager.executeFullPipeline(sessionId);

      //  Then:
      expect(progressEvents.length).toBeGreaterThan(0);

      const downloadProgress = progressEvents.find((e) => e.stage === 'download');
      const extract1Progress = progressEvents.find((e) => e.stage === 'extract1');
      const extract2Progress = progressEvents.find((e) => e.stage === 'extract2');
      const vectorTilesProgress = progressEvents.find((e) => e.stage === 'vectorTiles');

      expect(downloadProgress).toBeDefined();
      expect(extract1Progress).toBeDefined();
      expect(extract2Progress).toBeDefined();
      expect(vectorTilesProgress).toBeDefined();
    });
  });

  describe('エラーハンドリングテスト', () => {
    it('Workerの失敗が適切にハンドリングされる', async () => {
      //  Given: Worker
      const invalidConfig = {
        ...mockBatchConfig,
        download: {
          ...mockBatchConfig.download,
          concurrentDownloads: 0,
        },
      };

      //  When & Then: Worker
      await expect(
        batchSessionManager.startBatchSession(
          mockTreeNodeId,
          invalidConfig,
          ['INVALID_COUNTRY'],
          [0],
        ),
      ).rejects.toThrow('Invalid batch configuration');
    });

    it('中断されたセッションが適切にクリーンアップされる', async () => {
      //  Given:
      const sessionId = await batchSessionManager.startBatchSession(
        mockTreeNodeId,
        mockBatchConfig,
        ['JPN'],
        [0],
      );

      //  When:
      await batchSessionManager.abortSession(sessionId);

      //  Then:
      const status = await batchSessionManager.getSessionStatus(sessionId);
      expect(status.isAborted).toBe(true);
      expect(status.isCompleted).toBe(false);
    });
  });

  describe('境界値テスト', () => {
    it('タスク数ゼロのセッションが適切に処理される', async () => {
      //  Given:
      const emptyCountries: string[] = [];
      const adminLevels = [0];

      //  When & Then:
      await expect(
        batchSessionManager.startBatchSession(
          mockTreeNodeId,
          mockBatchConfig,
          emptyCountries,
          adminLevels,
        ),
      ).rejects.toThrow('No tasks to process');
    });

    it('大量のタスクを持つセッションが正常に処理される', async () => {
      //  Given:
      const manyCountries = ['USA', 'CAN', 'MEX', 'BRA', 'ARG', 'PER', 'COL', 'VEN'];
      const manyAdminLevels = [0, 1, 2, 3];

      //  When:
      const sessionId = await batchSessionManager.startBatchSession(
        mockTreeNodeId,
        mockBatchConfig,
        manyCountries,
        manyAdminLevels,
      );

      //  Then:
      expect(sessionId).toBeDefined();

      const status = await batchSessionManager.getSessionStatus(sessionId);
      expect(status.totalTasks).toBe(manyCountries.length * manyAdminLevels.length); //  8 4 = 32 tasks
    });
  });
});
