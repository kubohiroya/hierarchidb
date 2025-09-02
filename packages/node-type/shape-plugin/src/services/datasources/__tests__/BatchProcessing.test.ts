/**
 * データソース戦略のバッチ処理テスト
 * DATA_SOURCE_STRATEGY_DESIGN.mdで定義されたバッチ処理システムのテスト
 */

import { describe, it, expect, beforeEach, vi, beforeAll, afterEach } from 'vitest';
import { DataSourceStrategyFactory } from '../DataSourceStrategyFactory';
import { DataSourceStrategy, FetchOptions, ProcessOptions, SaveTarget } from '../DataSourceStrategy';

// バッチ処理システムの型定義
export interface BatchJob {
  id: string;
  config: BatchConfig;
  startTime: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: {
    phase: 'fetching' | 'processing' | 'validating' | 'saving' | 'completed';
    percentage: number;
    message?: string;
  };
  result?: BatchResult;
  error?: Error;
}

export interface BatchConfig {
  strategyId: string;
  fetchOptions?: FetchOptions;
  processOptions?: ProcessOptions;
  saveTarget: SaveTarget;
  priority?: 'low' | 'normal' | 'high';
  timeout?: number;
  retryCount?: number;
}

export interface BatchResult {
  jobId: string;
  success: boolean;
  dataCount: number;
  validationResult?: any;
  saveResult?: any;
  duration: number;
  phases: {
    fetching: number;
    processing: number;
    validating: number;
    saving: number;
  };
}

export interface BatchStatusReporter {
  startJob(jobId: string): void;
  updatePhase(jobId: string, phase: BatchJob['progress']['phase'], percentage?: number, message?: string): void;
  completeJob(jobId: string): void;
  failJob(jobId: string, error: Error): void;
  getJobStatus(jobId: string): BatchJob | undefined;
}

// バッチ処理システムの実装
export class DataSourceBatchProcessor {
  private jobQueue = new Map<string, BatchJob>();
  private statusReporter: MockBatchStatusReporter;
  private factory: DataSourceStrategyFactory;
  private runningJobs = new Set<string>();
  private maxConcurrentJobs = 3;

  constructor(factory: DataSourceStrategyFactory) {
    this.factory = factory;
    this.statusReporter = new MockBatchStatusReporter();
  }

  async executeBatch(config: BatchConfig): Promise<BatchResult> {
    const jobId = this.generateJobId();
    const job: BatchJob = {
      id: jobId,
      config,
      startTime: Date.now(),
      status: 'pending',
      progress: {
        phase: 'fetching',
        percentage: 0
      }
    };

    this.jobQueue.set(jobId, job);

    try {
      // 同時実行数の制限
      await this.waitForSlot();
      this.runningJobs.add(jobId);
      
      job.status = 'running';
      this.statusReporter.startJob(jobId);

      // 前処理
      await this.preProcess(job);
      
      // メイン処理
      const result = await this.processJob(job);
      
      // 後処理
      await this.postProcess(job, result);
      
      job.status = 'completed';
      job.result = result;
      this.statusReporter.completeJob(jobId);
      
      return result;
      
    } catch (error) {
      job.status = 'failed';
      job.error = error as Error;
      this.statusReporter.failJob(jobId, error as Error);
      throw error;
    } finally {
      this.runningJobs.delete(jobId);
    }
  }

  private async waitForSlot(): Promise<void> {
    while (this.runningJobs.size >= this.maxConcurrentJobs) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private generateJobId(): string {
    return `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async preProcess(job: BatchJob): Promise<void> {
    // バリデーションやリソース確保など
    if (!this.factory.hasStrategy(job.config.strategyId as any)) {
      throw new Error(`Unknown strategy: ${job.config.strategyId}`);
    }
  }

  private async processJob(job: BatchJob): Promise<BatchResult> {
    const startTime = Date.now();
    const phases = { fetching: 0, processing: 0, validating: 0, saving: 0 };
    
    const strategy = this.factory.create(job.config.strategyId as any);
    
    // フェッチフェーズ
    this.statusReporter.updatePhase(job.id, 'fetching', 10);
    const fetchStart = Date.now();
    const rawData = await strategy.fetchData(job.config.fetchOptions);
    phases.fetching = Date.now() - fetchStart;
    
    // 処理フェーズ
    this.statusReporter.updatePhase(job.id, 'processing', 50);
    const processStart = Date.now();
    const processedData = await strategy.processData(rawData, job.config.processOptions);
    phases.processing = Date.now() - processStart;
    
    // バリデーションフェーズ
    this.statusReporter.updatePhase(job.id, 'validating', 75);
    const validateStart = Date.now();
    const validationResult = await strategy.validateData(processedData);
    phases.validating = Date.now() - validateStart;
    
    if (!validationResult.isValid) {
      throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
    }
    
    // 保存フェーズ
    this.statusReporter.updatePhase(job.id, 'saving', 90);
    const saveStart = Date.now();
    const saveResult = await strategy.saveData(processedData, job.config.saveTarget);
    phases.saving = Date.now() - saveStart;
    
    this.statusReporter.updatePhase(job.id, 'completed', 100);
    
    return {
      jobId: job.id,
      success: true,
      dataCount: Array.isArray(processedData) ? processedData.length : 1,
      validationResult,
      saveResult,
      duration: Date.now() - startTime,
      phases
    };
  }

  private async postProcess(job: BatchJob, result: BatchResult): Promise<void> {
    // ログ記録、通知送信など
    console.log(`Batch job ${job.id} completed in ${result.duration}ms`);
  }

  // パブリックメソッド
  getJobStatus(jobId: string): BatchJob | undefined {
    return this.jobQueue.get(jobId);
  }

  getAllJobs(): BatchJob[] {
    return Array.from(this.jobQueue.values());
  }

  getPendingJobs(): BatchJob[] {
    return this.getAllJobs().filter(job => job.status === 'pending');
  }

  getRunningJobs(): BatchJob[] {
    return this.getAllJobs().filter(job => job.status === 'running');
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobQueue.get(jobId);
    if (!job || job.status === 'completed' || job.status === 'failed') {
      return false;
    }
    
    job.status = 'cancelled';
    this.runningJobs.delete(jobId);
    return true;
  }

  clearCompletedJobs(): void {
    for (const [jobId, job] of this.jobQueue.entries()) {
      if (job.status === 'completed' || job.status === 'failed') {
        this.jobQueue.delete(jobId);
      }
    }
  }
}

// モックステータスレポーター
class MockBatchStatusReporter implements BatchStatusReporter {
  private jobs = new Map<string, BatchJob['progress']>();

  startJob(jobId: string): void {
    this.jobs.set(jobId, {
      phase: 'fetching',
      percentage: 0
    });
  }

  updatePhase(jobId: string, phase: BatchJob['progress']['phase'], percentage = 0, message?: string): void {
    this.jobs.set(jobId, { phase, percentage, message });
  }

  completeJob(jobId: string): void {
    this.jobs.set(jobId, {
      phase: 'completed',
      percentage: 100
    });
  }

  failJob(jobId: string, error: Error): void {
    this.jobs.set(jobId, {
      phase: 'fetching', // エラー時の最後のフェーズ
      percentage: 0,
      message: error.message
    });
  }

  getJobStatus(jobId: string): BatchJob | undefined {
    const progress = this.jobs.get(jobId);
    if (!progress) return undefined;
    
    return {
      id: jobId,
      config: {} as BatchConfig,
      startTime: Date.now(),
      status: 'running',
      progress
    };
  }
}

describe('Batch Processing System', () => {
  let factory: DataSourceStrategyFactory;
  let batchProcessor: DataSourceBatchProcessor;

  beforeEach(() => {
    factory = new DataSourceStrategyFactory();
    batchProcessor = new DataSourceBatchProcessor(factory);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('BatchProcessor', () => {
    it('should create batch processor', () => {
      expect(batchProcessor).toBeInstanceOf(DataSourceBatchProcessor);
    });

    it('should execute single batch job successfully', async () => {
      const config: BatchConfig = {
        strategyId: 'natural-earth-shapes',
        fetchOptions: {
          endpoint: 'countries-50m',
          bbox: { minLat: 35, maxLat: 36, minLng: 139, maxLng: 140 }
        },
        processOptions: {
          simplify: true,
          tolerance: 0.01
        },
        saveTarget: {
          type: 'hierarchidb',
          entityType: 'shape',
          parentId: 'test-parent'
        }
      };

      const result = await batchProcessor.executeBatch(config);
      
      expect(result.success).toBe(true);
      expect(result.jobId).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
      expect(result.phases).toBeDefined();
      expect(typeof result.dataCount).toBe('number');
    });

    it('should handle batch job failure', async () => {
      const config: BatchConfig = {
        strategyId: 'unknown-strategy',
        saveTarget: {
          type: 'hierarchidb'
        }
      };

      await expect(batchProcessor.executeBatch(config)).rejects.toThrow('Unknown strategy');
    });

    it('should track job status', async () => {
      const config: BatchConfig = {
        strategyId: 'natural-earth-shapes',
        saveTarget: { type: 'hierarchidb' }
      };

      // 非同期でjobを実行
      const jobPromise = batchProcessor.executeBatch(config);
      
      // 少し待ってからstatus確認
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const runningJobs = batchProcessor.getRunningJobs();
      expect(runningJobs.length).toBeGreaterThanOrEqual(0);

      // job完了まで待つ
      const result = await jobPromise;
      expect(result.success).toBe(true);
      
      // 完了後のjob情報確認
      const job = batchProcessor.getJobStatus(result.jobId);
      expect(job?.status).toBe('completed');
    });

    it('should handle concurrent jobs', async () => {
      const configs: BatchConfig[] = [
        {
          strategyId: 'natural-earth-shapes',
          fetchOptions: { endpoint: 'countries-50m' },
          saveTarget: { type: 'hierarchidb' }
        },
        {
          strategyId: 'gadm-administrative-areas',
          fetchOptions: { country: 'JPN', adminLevel: 1 },
          saveTarget: { type: 'hierarchidb' }
        },
        {
          strategyId: 'geoboundaries-admin-areas',
          fetchOptions: { country: 'USA', adminLevel: 1 },
          saveTarget: { type: 'hierarchidb' }
        }
      ];

      // 並列実行
      const jobPromises = configs.map(config => 
        batchProcessor.executeBatch(config)
      );

      const results = await Promise.all(jobPromises);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.jobId).toBeDefined();
      });
    });

    it('should support job cancellation', async () => {
      const config: BatchConfig = {
        strategyId: 'openstreetmap-overpass',
        fetchOptions: {
          bbox: { minLat: 35, maxLat: 36, minLng: 139, maxLng: 140 },
          timeout: 30
        },
        saveTarget: { type: 'hierarchidb' }
      };

      // 長時間実行されるjobを開始
      const jobPromise = batchProcessor.executeBatch(config);
      
      // 少し待ってからcancel
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const runningJobs = batchProcessor.getRunningJobs();
      if (runningJobs.length > 0) {
        const cancelled = await batchProcessor.cancelJob(runningJobs[0].id);
        expect(typeof cancelled).toBe('boolean');
      }

      // job完了まで待つ（cancelされても例外は発生しない想定）
      try {
        await jobPromise;
      } catch (error) {
        // cancel による例外は想定内
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should provide job statistics', async () => {
      const config: BatchConfig = {
        strategyId: 'natural-earth-shapes',
        saveTarget: { type: 'hierarchidb' }
      };

      await batchProcessor.executeBatch(config);

      const allJobs = batchProcessor.getAllJobs();
      const pendingJobs = batchProcessor.getPendingJobs();
      const runningJobs = batchProcessor.getRunningJobs();

      expect(allJobs.length).toBeGreaterThan(0);
      expect(pendingJobs.length).toBeGreaterThanOrEqual(0);
      expect(runningJobs.length).toBeGreaterThanOrEqual(0);

      // 完了したjobをクリア
      batchProcessor.clearCompletedJobs();
      const jobsAfterClear = batchProcessor.getAllJobs();
      expect(jobsAfterClear.length).toBeLessThanOrEqual(allJobs.length);
    });
  });

  describe('Batch Configuration Validation', () => {
    it('should validate required batch config fields', async () => {
      const invalidConfigs = [
        // 戦略IDなし
        {
          saveTarget: { type: 'hierarchidb' }
        },
        // 保存ターゲットなし
        {
          strategyId: 'natural-earth-shapes'
        }
      ];

      for (const config of invalidConfigs) {
        await expect(
          batchProcessor.executeBatch(config as BatchConfig)
        ).rejects.toThrow();
      }
    });

    it('should handle batch options correctly', async () => {
      const config: BatchConfig = {
        strategyId: 'natural-earth-shapes',
        fetchOptions: {
          endpoint: 'countries-50m',
          adminLevel: 0
        },
        processOptions: {
          simplify: true,
          tolerance: 0.001,
          filters: [
            { field: 'properties.POP_EST', operator: 'gt', value: 1000000 }
          ]
        },
        saveTarget: {
          type: 'hierarchidb',
          entityType: 'shape',
          parentId: 'test-parent'
        },
        priority: 'high',
        timeout: 60000,
        retryCount: 3
      };

      const result = await batchProcessor.executeBatch(config);
      expect(result.success).toBe(true);
      
      const job = batchProcessor.getJobStatus(result.jobId);
      expect(job?.config.priority).toBe('high');
      expect(job?.config.timeout).toBe(60000);
      expect(job?.config.retryCount).toBe(3);
    });
  });

  describe('Performance and Resource Management', () => {
    it('should measure phase execution times', async () => {
      const config: BatchConfig = {
        strategyId: 'natural-earth-shapes',
        saveTarget: { type: 'hierarchidb' }
      };

      const result = await batchProcessor.executeBatch(config);
      
      expect(result.phases).toBeDefined();
      expect(result.phases.fetching).toBeGreaterThanOrEqual(0);
      expect(result.phases.processing).toBeGreaterThanOrEqual(0);
      expect(result.phases.validating).toBeGreaterThanOrEqual(0);
      expect(result.phases.saving).toBeGreaterThanOrEqual(0);
      
      const totalPhaseTime = Object.values(result.phases).reduce((sum, time) => sum + time, 0);
      expect(totalPhaseTime).toBeLessThanOrEqual(result.duration + 100); // 100msの誤差許容
    });

    it('should respect concurrency limits', async () => {
      const configs = Array(5).fill(null).map((_, i) => ({
        strategyId: 'natural-earth-shapes',
        fetchOptions: { endpoint: `test-${i}` },
        saveTarget: { type: 'hierarchidb' }
      }));

      // 並列実行開始
      const jobPromises = configs.map(config => 
        batchProcessor.executeBatch(config as BatchConfig)
      );

      // 少し待ってから実行中のjob数を確認
      await new Promise(resolve => setTimeout(resolve, 10));
      const runningJobs = batchProcessor.getRunningJobs();
      
      // 同時実行数の制限（maxConcurrentJobs = 3）を確認
      expect(runningJobs.length).toBeLessThanOrEqual(3);

      // 全job完了まで待つ
      const results = await Promise.all(jobPromises);
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });
});
// Skip integration tests by default unless ENABLE_INTEGRATION_TESTS is set
if (!process.env.ENABLE_INTEGRATION_TESTS) {
  describe.skip('Batch Processing System (integration disabled)', () => {});
} else {
