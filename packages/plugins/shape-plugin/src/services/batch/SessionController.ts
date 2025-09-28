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
import type { DownloadStageAdapter } from './adapters/DownloadStageAdapter.js';
import { RuntimeWorkerDownloadAdapter } from './adapters/RuntimeWorkerDownloadAdapter.js';
import type { Simplify1Task, Simplify2Task, VectorTileTask } from '../types.js';
import type { Simplify1StageAdapter } from './adapters/Simplify1StageAdapter.js';
import type { Simplify2StageAdapter } from './adapters/Simplify2StageAdapter.js';
import type { VectorTileStageAdapter } from './adapters/VectorTileStageAdapter.js';
import { RuntimeWorkerSimplify1Adapter, RuntimeWorkerSimplify2Adapter } from './adapters/RuntimeWorkerSimplifyAdapters.js';
import { RuntimeWorkerVectorTileAdapter } from './adapters/RuntimeWorkerVectorTileAdapter.js';
import { getShapeRuntimeWorkerClient } from './adapters/RuntimeWorkerClient.js';
import type { BatchProcessConfig } from './types.js';
import type { UrlMetadata, ProgressInfo, ProcessingStage } from '../../shared/index.js';
import type { DownloadTask } from '../../shared/types.js';

export interface BatchSessionOptions {
  maxConcurrentTasks?: number;
  retryAttempts?: number;
  timeoutMs?: number;
  enableResourceTracking?: boolean;
}

export class SessionController {
  public readonly sessionId: string;
  private nodeId: NodeId;
  private workerPool: any | null = null;
  private downloadAdapter: DownloadStageAdapter = new RuntimeWorkerDownloadAdapter();
  private urlMetadata: UrlMetadata[];
  private config: BatchProcessConfig;
  private options: BatchSessionOptions;
  private currentStage: ProcessingStage = 'download';
  private isPaused = false;
  private isAborted = false;
  private progressCallback?: (progress: ProgressInfo) => void;
  private simplify1Adapter?: Simplify1StageAdapter;
  private simplify2Adapter?: Simplify2StageAdapter;
  private vectorTileAdapter?: VectorTileStageAdapter;
  private readonly pausedStages = new Set<ProcessingStage>();
  private readonly stageWaiters = new Map<ProcessingStage, Array<() => void>>();

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

    // Prefer runtime-worker adapters when a client is available; otherwise optionally fall back to WorkerPool-backed ones
    const client = await getShapeRuntimeWorkerClient();
    if (client) {
      this.simplify1Adapter = new RuntimeWorkerSimplify1Adapter();
      this.simplify2Adapter = new RuntimeWorkerSimplify2Adapter();
      this.vectorTileAdapter = new RuntimeWorkerVectorTileAdapter();
    } else {
      // No runtime-worker: raise explicit guidance (fallback path removed)
      throw new Error('Shape runtime worker unavailable. Legacy WorkerPool fallback has been removed.');
    }
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
    this.resumeAllStages();

    // Continue from current stage
    await this.start();
  }

  /**
   * Abort the session and cleanup resources
   */
  async abort(): Promise<void> {
    this.isAborted = true;
    console.log(`[Session ${this.sessionId}] Session aborted`);
    this.resumeAllStages();
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
    this.resumeAllStages();
  }

  /**
   * Process download stage
   */
  private async processDownloadStage(): Promise<void> {
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
    const res = await this.downloadAdapter.process(
      this.sessionId,
      this.nodeId,
      tasks,
      (p) => this.progressCallback?.(p),
      { waitIfPaused: () => this.waitForStageResume('download') },
    );
    console.log(`[Session ${this.sessionId}] Download stage completed: ${res.processed} successful, ${res.failed} failed`);
    const percentage = (res.processed / tasks.length) * 100;
    this.progressCallback?.({
      total: tasks.length,
      completed: res.processed,
      failed: res.failed,
      skipped: 0,
      percentage,
      currentStage: 'download',
      currentTask: 'Download completed',
    });
  }

  /**
   * Process simplify1 stage
   */
  private async processSimplify1Stage(): Promise<void> {
    this.currentStage = 'simplify1';
    console.log(`[Session ${this.sessionId}] Processing simplify1 stage`);

    const tasks: Simplify1Task[] = this.urlMetadata.map((metadata, index) => ({
      taskId: `${this.sessionId}-simplify1-${index}`,
      inputBufferId: `${this.sessionId}-download-${index}`,
      tolerance: this.config.simplifyTolerance || 0.001,
      minArea: this.config.minArea || 100,
    }));

    const r = await this.simplify1Adapter!.process(tasks, (p) => this.progressCallback?.(p), {
      waitIfPaused: () => this.waitForStageResume('simplify1'),
    });
    console.log(`[Session ${this.sessionId}] Simplify1 stage completed: ${r.processed}/${tasks.length} successful`);
  }

  /**
   * Process simplify2 stage
   */
  private async processSimplify2Stage(): Promise<void> {
    this.currentStage = 'simplify2';
    console.log(`[Session ${this.sessionId}] Processing simplify2 stage`);

    const tasks: Simplify2Task[] = this.urlMetadata.map((metadata, index) => ({
      taskId: `${this.sessionId}-simplify2-${index}`,
      inputBufferId: `${this.sessionId}-simplify1-${index}`,
      zoomLevels: this.config.zoomLevels || [0, 5, 10],
      tileSize: this.config.tileSize || 512,
    }));

    const r = await this.simplify2Adapter!.process(tasks, (p) => this.progressCallback?.(p), {
      waitIfPaused: () => this.waitForStageResume('simplify2'),
    });
    console.log(`[Session ${this.sessionId}] Simplify2 stage completed: ${r.processed}/${tasks.length} successful`);
  }

  /**
   * Process vector tile generation stage
   */
  private async processVectorTileStage(): Promise<void> {
    this.currentStage = 'vectortile';
    console.log(`[Session ${this.sessionId}] Processing vector tile stage`);

    const tasks: VectorTileTask[] = this.urlMetadata.map((metadata, index) => ({
      taskId: `${this.sessionId}-vectortile-${index}`,
      inputBufferId: `${this.sessionId}-simplify2-${index}`,
      outputFormat: 'mvt',
      compression: 'gzip',
    }));

    const r = await this.vectorTileAdapter!.process(tasks, (p) => this.progressCallback?.(p), {
      waitIfPaused: () => this.waitForStageResume('vectortile'),
    });
    console.log(`[Session ${this.sessionId}] Vector tile stage completed: ${r.processed}/${tasks.length} successful`);
  }

  /**
   * Set progress callback
   */
  setProgressCallback(callback: (progress: ProgressInfo) => void): void {
    this.progressCallback = callback;
  }

  pauseStage(stage: ProcessingStage): void {
    this.pausedStages.add(stage);
  }

  resumeStage(stage: ProcessingStage): void {
    if (!this.pausedStages.delete(stage)) return;
    this.resolveStageWaiters(stage);
  }

  resumeAllStages(): void {
    for (const stage of [...this.pausedStages]) {
      this.pausedStages.delete(stage);
      this.resolveStageWaiters(stage);
    }
  }

  private async waitForStageResume(stage: ProcessingStage): Promise<void> {
    if (!this.pausedStages.has(stage)) {
      return;
    }
    await new Promise<void>((resolve) => {
      const waiters = this.stageWaiters.get(stage) ?? [];
      waiters.push(resolve);
      this.stageWaiters.set(stage, waiters);
    });
  }

  private resolveStageWaiters(stage: ProcessingStage): void {
    const waiters = this.stageWaiters.get(stage);
    if (!waiters) return;
    for (const release of waiters) release();
    this.stageWaiters.delete(stage);
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
