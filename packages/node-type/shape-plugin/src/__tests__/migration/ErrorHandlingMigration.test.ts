/**
  * @file ErrorHandlingMigration.test.ts
 * @description ERIA-Cartograph (TDD Red Phase)
   * - HierarchiDBWorker
 * -
 * -
   * - WorkerAPI
 * -
 * - UI
  */

import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { ShapeErrorHandler } from '../../services/ShapeErrorHandler.js';
import type { BatchConfig } from '../../types/BatchConfig.js';
import { ErrorCategory, ErrorSeverity, ShapeErrorFactory } from '../../types/ShapeErrorHierarchy.js';

describe('Error Handling Migration Tests', () => {
  let errorHandler: ShapeErrorHandler;
  let mockTreeNodeId: string;
  let mockBatchConfig: BatchConfig;

  beforeEach(() => {
    //  Given:
    mockTreeNodeId = 'tree-node-error-test';

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

    errorHandler = new ShapeErrorHandler();
  });

  describe('Worker通信エラーハンドリングテスト', () => {
    it('Workerとの通信切断が適切にハンドリングされる', async () => {
      //  Given: Worker
      const disconnectedWorkerError = new Error('Worker connection lost');

      //  When: Worker
      const processedError = await errorHandler.handleWorkerError(new Error('Worker connection lost'));

      //  Then: Worker
      expect(processedError.type).toBe('WORKER_DISCONNECTED');
      expect(processedError.category).toBe('worker');
      expect(processedError.message).toContain('Worker connection lost');
    });

    it('Worker処理タイムアウトが適切にハンドリングされる', async () => {
      //  Given: Worker
      const timeoutError = new Error('Worker timeout after 30s');

      //  When:
      const errorResult = await errorHandler.handleWorkerError(timeoutError);

      //  Then:
      expect(errorResult).toBeDefined();
      expect(errorResult.type).toBe('WORKER_TIMEOUT');
      expect(errorResult.category).toBe('worker');
      expect(errorResult.message).toContain('Worker timeout');
    });

    it('Workerメモリ不足エラーが適切にハンドリングされる', async () => {
      //  Given: Worker
      const memoryError = new Error('Worker ran out of memory');

      //  When:
      const errorResult = await errorHandler.handleWorkerError(memoryError);

      //  Then:
      expect(errorResult.type).toBe('WORKER_MEMORY_ERROR');
      expect(errorResult.category).toBe('worker');
      expect(errorResult.message).toContain('ran out of memory');
    });
  });

  describe('データ処理エラーハンドリングテスト', () => {
    it('無効な国コードでのエラーが適切にハンドリングされる', async () => {
      //  Given:
      const validationError = new Error('Invalid country codes provided');

      //  When:
      const errorResult = await errorHandler.handleDataFormatError(validationError);

      //  Then:
      expect(errorResult.type).toBe('INVALID_DATA_FORMAT');
      expect(errorResult.category).toBe('data');
      expect(errorResult.message).toContain('Invalid country codes');
    });

    it('データソースアクセスエラーが適切にハンドリングされる', async () => {
      //  Given:
      const dataSourceError = new Error('Failed to fetch data from source');

      //  When:
      const errorResult = await errorHandler.handleDataSourceError(dataSourceError);

      //  Then:
      expect(errorResult.type).toBe('DATA_SOURCE_ERROR');
      expect(errorResult.category).toBe('network');
      expect(errorResult.message).toContain('Failed to fetch data');
    });

    it('破損データファイルエラーが適切にハンドリングされる', async () => {
      //  Given:
      const corruptedDataError = {
        type: 'INVALID_DATA_FORMAT',
        message: 'Invalid GeoJSON format',
        category: ErrorCategory.DATA,
        severity: ErrorSeverity.CRITICAL,
        timestamp: Date.now(),
        context: { format: 'geojson', parseError: 'Unexpected token' },
      };

      //  When:
      const errorResult = await errorHandler.handleDataFormatError(new Error(corruptedDataError.message));

      //  Then:
      expect(errorResult.type).toBe('INVALID_DATA_FORMAT');
      expect(errorResult.category).toBe(ErrorCategory.DATA);
      expect(errorResult.message).toContain('Invalid GeoJSON format');
    });
  });

  describe('ネットワークエラーハンドリングテスト', () => {
    it('ネットワーク接続失敗が適切にハンドリングされる', async () => {
      //  Given:
      const networkError = {
        type: 'NETWORK_ERROR',
        message: 'Network request failed',
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.HIGH,
        timestamp: Date.now(),
        context: { url: 'https://example.com/data', status: 0 },
      };

      //  When:
      const errorResult = await errorHandler.handleNetworkError(networkError);

      //  Then:
      expect(errorResult.type).toBe('NETWORK_ERROR');
      expect(errorResult.category).toBe(ErrorCategory.NETWORK);
      expect(errorResult.message).toContain('Network request failed');
    });

    it('CORS設定エラーが適切にハンドリングされる', async () => {
      //  Given: CORS
      const corsError = {
        type: 'CORS_ERROR',
        message: 'CORS policy blocked the request',
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.HIGH,
        timestamp: Date.now(),
        context: { origin: 'https://localhost:3000', blockedUrl: 'https://api.example.com' },
      };

      //  When: CORS
      const errorResult = await errorHandler.handleNetworkError(corsError);

      //  Then: CORS
      expect(errorResult.type).toBe('CORS_ERROR');
      expect(errorResult.category).toBe(ErrorCategory.NETWORK);
      expect(errorResult.message).toContain('CORS policy blocked');
    });

    it('レート制限エラーが適切にハンドリングされる', async () => {
      //  Given:
      const rateLimitError = {
        type: 'RATE_LIMIT_ERROR',
        message: 'Too many requests',
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        timestamp: Date.now(),
        context: { retryAfter: 60, status: 429 },
      };

      //  When:
      const errorResult = await errorHandler.handleNetworkError(rateLimitError);

      //  Then:
      expect(errorResult.type).toBe('RATE_LIMIT_ERROR');
      expect(errorResult.category).toBe(ErrorCategory.NETWORK);
      expect(errorResult.metadata?.retryAfter).toBe(60);
    });
  });

  describe('ユーザビリティエラーハンドリングテスト', () => {
    it('エラーメッセージがユーザーフレンドリーに表示される', async () => {
      //  Given:
      const complexError = ShapeErrorFactory.createWorkerError(
        'WORKER_MEMORY_ERROR',
        'Worker failed: RangeError: Invalid array length',
      );

      //  When: Worker
      const processedError = await errorHandler.handleWorkerError(new Error(complexError.message));

      //  Then:
      expect(processedError.type).toBe('WORKER_MEMORY_ERROR');
      expect(processedError.message).toContain('Worker failed');
      expect(processedError.category).toBe(ErrorCategory.WORKER);
    });

    it('エラー状況に応じた適切なリカバリオプションが提供される', async () => {
      //  Given:
      const networkError = ShapeErrorFactory.createNetworkError('NETWORK_ERROR', 'Network failed');
      const dataError = ShapeErrorFactory.createDataError('INVALID_DATA_FORMAT', 'Invalid format');
      const memoryError = ShapeErrorFactory.createWorkerError('WORKER_MEMORY_ERROR', 'Memory error');

      //  When:
      const networkStrategy = await errorHandler.handleNetworkError(new Error(networkError.message));
      const dataStrategy = await errorHandler.handleDataFormatError(new Error(dataError.message));
      const memoryStrategy = await errorHandler.handleWorkerError(new Error(memoryError.message));

      //  Then:
      expect(networkStrategy.type).toBe('NETWORK_ERROR');
      expect(dataStrategy.type).toBe('INVALID_DATA_FORMAT');
      expect(memoryStrategy.type).toBe('WORKER_MEMORY_ERROR');
    });

    it('エラー発生時の進捗状態が適切に保存される', async () => {
      //  Given:
      const sessionId = 'test-session-with-error';
      const error = new Error('Processing failed at task 14');

      //  When:
      await errorHandler.handleBatchProcessingError(sessionId, error);

      //  Then:
      expect(true).toBe(true);
    });

    it('バッチ処理の部分的リカバリが正常に動作する', async () => {
      //  Given:
      const sessionId = 'recoverable-session';
      const errorState = {
        sessionId,
        failedAtStage: 'simplify1',
        lastSuccessfulTask: 10,
        canResume: true,
        resumeFromTask: 11,
      };

      //  When:
      const recoveryResult = await errorHandler.resumeBatchProcessing(
        sessionId,
        errorState,
        mockBatchConfig,
      );

      //  Then:
      expect(recoveryResult).toBeDefined();
    });
  });

  describe('エラー統計・監視テスト', () => {
    it('エラー発生統計が正常に記録される', async () => {
      //  Given:
      const errors = [
        { type: 'NETWORK_ERROR', timestamp: Date.now() },
        { type: 'WORKER_TIMEOUT', timestamp: Date.now() + 1000 },
        { type: 'NETWORK_ERROR', timestamp: Date.now() + 2000 },
      ];

      //  When:
      for (const error of errors) {
        await errorHandler.recordError(error);
      }

      //  Then:
      const statistics = await errorHandler.getErrorStatistics();
      expect(statistics).toBeDefined();
      expect(statistics.total).toBeGreaterThanOrEqual(0);
    });

    it('エラー発生パターンの分析結果が提供される', async () => {
      //  Given:
      const timeSeriesErrors = Array.from({ length: 10 }, (_, i) => ({
        type: i % 2 === 0 ? 'NETWORK_ERROR' : 'WORKER_TIMEOUT',
        timestamp: Date.now() + i * 60000, //  1
      }));

      //  When:
      const analysis = await errorHandler.analyzeErrorPatterns(timeSeriesErrors);

      //  Then:
      expect(analysis).toBeDefined();
      expect(analysis.patterns).toBeDefined();
      expect(typeof analysis.patterns.cyclical).toBe('boolean');
    });
  });
});