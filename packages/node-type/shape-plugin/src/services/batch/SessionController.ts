/**
 * SessionController - Manages a single batch processing session with its own WorkerPool
 *
 * Features:
 * - Owns and manages WorkerPoolManager lifecycle
 * - Handles session state and progress tracking
 * - Coordinates task execution across stages
 * - Ensures proper cleanup on completion/abort
 */

import type { NodeId } from '@hierarchidb/common-type';
import { WorkerPoolManager } from '../workers/WorkerPoolManager';
import type { Simplify1Task, Simplify2Task, VectorTileTask, WorkerPoolConfig } from '../types';
import type { BatchProcessConfig } from './types';
import type { UrlMetadata, ProgressInfo, ProcessingStage } from '../../shared';
import type { DownloadTask } from '../../shared/types';

export interface BatchSessionOptions {
  maxConcurrentTasks?: number;
  retryAttempts?: number;
  timeoutMs?: number;
  enableResourceTracking?: boolean;
}

export class SessionController {
  public readonly sessionId: string;
  private nodeId: NodeId;
  private workerPool: WorkerPoolManager | null = null;
  private urlMetadata: UrlMetadata[];
  private config: BatchProcessConfig;
  private options: BatchSessionOptions;
  private currentStage: ProcessingStage = 'download';
  private isPaused = false;
  private isAborted = false;
  private progressCallback?: (progress: ProgressInfo) => void;

  constructor(
    sessionId: string,
    nodeId: NodeId,
    urlMetadata: UrlMetadata[],
    config: BatchProcessConfig,
    options: BatchSessionOptions = {},
  ) {
    this.sessionId = sessionId;
    this.nodeId = nodeId;
    this.urlMetadata = urlMetadata;
    this.config = config;
    this.options = options;
  }

  /**
   * Initialize the session by creating a new WorkerPool
   */
  async initialize(): Promise<void> {
    if (this.workerPool) {
      throw new Error(`Session ${this.sessionId} already initialized`);
    }

    // Create WorkerPool configuration based on batch config
    const poolConfig: WorkerPoolConfig = {
      downloadWorkers: this.config.downloadWorkers || 2,
      simplify1Workers: this.config.simplify1Workers || 2,
      simplify2Workers: this.config.simplify2Workers || 1,
      vectorTileWorkers: this.config.vectorTileWorkers || 1,
      workerOptions: {
        timeout: this.config.workerTimeout || 300000,
        retries: this.config.workerRetries || 3,
        maxMemoryPerWorker: this.config.maxMemoryPerWorker || 512 * 1024 * 1024,
        restartThreshold: 5,
      },
    };

    // Create and initialize WorkerPool for this session
    console.log(`[Session ${this.sessionId}] Creating WorkerPool with config:`, poolConfig);
    this.workerPool = new WorkerPoolManager(poolConfig);
    await this.workerPool.initialize();
    console.log(`[Session ${this.sessionId}] WorkerPool initialized successfully`);
  }

  /**
   * Start processing the batch session
   */
  async start(): Promise<void> {
    if (!this.workerPool) {
      await this.initialize();
    }

    console.log(`[Session ${this.sessionId}] Starting batch processing`);

    try {
      // Process each stage sequentially
      await this.processDownloadStage();

      if (!this.isAborted && !this.isPaused) {
        await this.processSimplify1Stage();
      }

      if (!this.isAborted && !this.isPaused) {
        await this.processSimplify2Stage();
      }

      if (!this.isAborted && !this.isPaused) {
        await this.processVectorTileStage();
      }

      if (!this.isAborted && !this.isPaused) {
        console.log(`[Session ${this.sessionId}] Batch processing completed successfully`);
      }
    } catch (error) {
      console.error(`[Session ${this.sessionId}] Batch processing failed:`, error);
      throw error;
    } finally {
      // Always cleanup on completion
      if (!this.isPaused) {
        await this.cleanup();
      }
    }
  }

  /**
   * Pause the session (keeps WorkerPool alive for resume)
   */
  async pause(): Promise<void> {
    this.isPaused = true;
    console.log(`[Session ${this.sessionId}] Session paused`);
    // Note: We keep the WorkerPool alive for resume
  }

  /**
   * Resume the session
   */
  async resume(): Promise<void> {
    if (!this.isPaused) {
      throw new Error(`Session ${this.sessionId} is not paused`);
    }

    this.isPaused = false;
    console.log(`[Session ${this.sessionId}] Session resumed`);

    // Continue from current stage
    await this.start();
  }

  /**
   * Abort the session and cleanup resources
   */
  async abort(): Promise<void> {
    this.isAborted = true;
    console.log(`[Session ${this.sessionId}] Session aborted`);
    await this.cleanup();
  }

  /**
   * Cleanup resources (terminates WorkerPool)
   */
  private async cleanup(): Promise<void> {
    if (this.workerPool) {
      console.log(`[Session ${this.sessionId}] Shutting down WorkerPool`);
      await this.workerPool.shutdown();
      this.workerPool = null;
      console.log(`[Session ${this.sessionId}] WorkerPool terminated`);
    }
  }

  /**
   * Process download stage
   */
  private async processDownloadStage(): Promise<void> {
    if (!this.workerPool) {
      throw new Error('WorkerPool not initialized');
    }

    this.currentStage = 'download';
    console.log(`[Session ${this.sessionId}] Processing download stage`);

    const tasks: DownloadTask[] = this.urlMetadata.map((metadata, index) => ({
      taskId: `${this.sessionId}-download-${index}`,
      url: metadata.url,
      dataSource: metadata.dataSource,
      country: metadata.country,
      adminLevel: metadata.adminLevel,
      expectedFormat: 'geojson',
    }));

    // Process download tasks via shared BatchService
    const { BatchService } = await import('@hierarchidb/batch');
    const batch = new BatchService();
    let completed = 0;
    let failed = 0;
    await batch.mapChunks(tasks, async (task) => {
      try {
        await this.workerPool!.processDownloadTask(task);
        completed++;
      } catch {
        failed++;
      }
      this.progressCallback?.({
        total: tasks.length,
        completed,
        failed,
        skipped: 0,
        percentage: (completed / tasks.length) * 100,
        currentStage: 'download',
        currentTask: task.taskId,
      });
    }, { concurrency: this.config.downloadWorkers || 2 });

    console.log(`[Session ${this.sessionId}] Download stage completed: ${completed} successful, ${failed} failed`);

    this.progressCallback?.({
      total: tasks.length,
      completed,
      failed,
      skipped: 0,
      percentage: (completed / tasks.length) * 100,
      currentStage: 'download',
      currentTask: 'Download completed',
    });
  }

  /**
   * Process simplify1 stage
   */
  private async processSimplify1Stage(): Promise<void> {
    if (!this.workerPool) {
      throw new Error('WorkerPool not initialized');
    }

    this.currentStage = 'simplify1';
    console.log(`[Session ${this.sessionId}] Processing simplify1 stage`);

    const tasks: Simplify1Task[] = this.urlMetadata.map((metadata, index) => ({
      taskId: `${this.sessionId}-simplify1-${index}`,
      inputBufferId: `${this.sessionId}-download-${index}`,
      tolerance: this.config.simplifyTolerance || 0.001,
      minArea: this.config.minArea || 100,
    }));

    const { BatchService } = await import('@hierarchidb/batch');
    const batch = new BatchService();
    let completed = 0;
    let failed = 0;
    await batch.mapChunks(tasks, async (task) => {
      try {
        await this.workerPool!.processSimplify1Task(task);
        completed++;
      } catch {
        failed++;
      }
      this.progressCallback?.({
        total: tasks.length,
        completed,
        failed,
        skipped: 0,
        percentage: (completed / tasks.length) * 100,
        currentStage: 'simplify1',
        currentTask: task.taskId,
      });
    }, { concurrency: this.config.simplify1Workers || 2 });
    console.log(`[Session ${this.sessionId}] Simplify1 stage completed: ${completed}/${tasks.length} successful`);
  }

  /**
   * Process simplify2 stage
   */
  private async processSimplify2Stage(): Promise<void> {
    if (!this.workerPool) {
      throw new Error('WorkerPool not initialized');
    }

    this.currentStage = 'simplify2';
    console.log(`[Session ${this.sessionId}] Processing simplify2 stage`);

    const tasks: Simplify2Task[] = this.urlMetadata.map((metadata, index) => ({
      taskId: `${this.sessionId}-simplify2-${index}`,
      inputBufferId: `${this.sessionId}-simplify1-${index}`,
      zoomLevels: this.config.zoomLevels || [0, 5, 10],
      tileSize: this.config.tileSize || 512,
    }));

    const { BatchService } = await import('@hierarchidb/batch');
    const batch = new BatchService();
    let completed = 0;
    let failed = 0;
    await batch.mapChunks(tasks, async (task) => {
      try {
        await this.workerPool!.processSimplify2Task(task);
        completed++;
      } catch {
        failed++;
      }
      this.progressCallback?.({
        total: tasks.length,
        completed,
        failed,
        skipped: 0,
        percentage: (completed / tasks.length) * 100,
        currentStage: 'simplify2',
        currentTask: task.taskId,
      });
    }, { concurrency: this.config.simplify2Workers || 1 });
    console.log(`[Session ${this.sessionId}] Simplify2 stage completed: ${completed}/${tasks.length} successful`);
  }

  /**
   * Process vector tile generation stage
   */
  private async processVectorTileStage(): Promise<void> {
    if (!this.workerPool) {
      throw new Error('WorkerPool not initialized');
    }

    this.currentStage = 'vectortile';
    console.log(`[Session ${this.sessionId}] Processing vector tile stage`);

    const tasks: VectorTileTask[] = this.urlMetadata.map((metadata, index) => ({
      taskId: `${this.sessionId}-vectortile-${index}`,
      inputBufferId: `${this.sessionId}-simplify2-${index}`,
      outputFormat: 'mvt',
      compression: 'gzip',
    }));

    const { BatchService } = await import('@hierarchidb/batch');
    const batch = new BatchService();
    let completed = 0;
    let failed = 0;
    await batch.mapChunks(tasks, async (task) => {
      try {
        await this.workerPool!.processVectorTileTask(task);
        completed++;
      } catch {
        failed++;
      }
      this.progressCallback?.({
        total: tasks.length,
        completed,
        failed,
        skipped: 0,
        percentage: (completed / tasks.length) * 100,
        currentStage: 'vectortile',
        currentTask: task.taskId,
      });
    }, { concurrency: this.config.vectorTileWorkers || 1 });
    console.log(`[Session ${this.sessionId}] Vector tile stage completed: ${completed}/${tasks.length} successful`);
  }

  /**
   * Set progress callback
   */
  setProgressCallback(callback: (progress: ProgressInfo) => void): void {
    this.progressCallback = callback;
  }

  /**
   * Get current session status
   */
  getStatus(): {
    sessionId: string;
    stage: ProcessingStage;
    isPaused: boolean;
    isAborted: boolean;
    hasWorkerPool: boolean;
  } {
    return {
      sessionId: this.sessionId,
      stage: this.currentStage,
      isPaused: this.isPaused,
      isAborted: this.isAborted,
      hasWorkerPool: this.workerPool !== null,
    };
  }

  /**
   * Get WorkerPool statistics
   */
  getPoolStatistics() {
    if (!this.workerPool) {
      return null;
    }
    return this.workerPool.getPoolStatistics();
  }
}
