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
import { BatchService } from '@hierarchidb/batch';
import { WorkerPoolManager } from '../workers/WorkerPoolManager';
import type {
  BatchSession,
  ProgressInfo,
  WorkerPoolConfig,
  DownloadTask,
  Simplify1Task,
  Simplify2Task,
  VectorTileTask,
} from '../types';
import type { BatchProcessConfig } from './types';
import type { UrlMetadata } from '../../types';
import type { BatchStage } from '../../types/BatchTaskLike';

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
  private currentStage: BatchStage = 'download';
  private isPaused = false;
  private isAborted = false;
  private progressCallback?: (progress: ProgressInfo) => void;
  private batch = new BatchService();
  
  constructor(
    sessionId: string,
    nodeId: NodeId,
    urlMetadata: UrlMetadata[],
    config: BatchProcessConfig,
    options: BatchSessionOptions = {}
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
      sessionId: this.sessionId,
      type: 'download',
      status: 'waiting',
      index,
      progress: 0,
      nodeId: this.nodeId,
      config: {
        dataSource: metadata.dataSource,
        country: metadata.country,
        adminLevel: metadata.adminLevel,
        url: metadata.url,
        timeout: this.options.timeoutMs ?? 300000,
        retryDelay: 1000,
        expectedFormat: 'geojson',
        validateSSL: true,
      },
    }));
    
    // Process download tasks in parallel
    let successful = 0;
    let failed = 0;
    const concurrency = Math.max(1, this.config.downloadWorkers || 2);
    const downloadResults = await this.batch.mapChunks(tasks, async (task) => {
      try {
        const res = await this.workerPool!.processDownloadTask(task);
        successful++;
        return res;
      } catch {
        failed++;
      }
    }, {
      concurrency,
      progress: (completed) => {
        if (this.progressCallback) {
          this.progressCallback({
            sessionId: this.sessionId,
            stage: 'download',
            total: tasks.length,
            completed,
            failed,
            percentage: (completed / tasks.length) * 100,
            currentTask: `Downloading (${completed}/${tasks.length})`,
          });
        }
      }
    });
    
    console.log(`[Session ${this.sessionId}] Download stage completed: ${successful} successful, ${failed} failed`);
    
    if (this.progressCallback) {
      this.progressCallback({
        sessionId: this.sessionId,
        stage: 'download',
        total: tasks.length,
        completed: successful,
        failed,
        percentage: (successful / tasks.length) * 100,
        currentTask: 'Download completed',
      });
    }
    this.downloadResults = (downloadResults || []).filter(Boolean) as any;
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
    
    const tasks: Simplify1Task[] = this.downloadResults.map((res, index) => ({
      taskId: `${this.sessionId}-simplify1-${index}`,
      sessionId: this.sessionId,
      type: 'simplify1',
      status: 'waiting',
      index,
      progress: 0,
      inputBufferId: res.outputBufferId,
      config: {
        algorithm: 'douglas-peucker',
        tolerance: this.config.simplifyTolerance || 0.001,
        preserveTopology: true,
        minimumArea: this.config.minArea || 100,
      },
    }));

    let successful = 0;
    let failed = 0;
    const concurrency = Math.max(1, this.config.simplify1Workers || 2);
    const simp1Results = await this.batch.mapChunks(tasks, async (task) => {
      try {
        const res = await this.workerPool!.processSimplify1Task(task);
        successful++;
        return res;
      } catch {
        failed++;
      }
    }, {
      concurrency,
      progress: (completed) => {
        if (this.progressCallback) {
          this.progressCallback({
            sessionId: this.sessionId,
            stage: 'simplify1',
            total: tasks.length,
            completed,
            failed,
            percentage: (completed / tasks.length) * 100,
            currentTask: `Simplify1 (${completed}/${tasks.length})`,
          });
        }
      }
    });
    console.log(`[Session ${this.sessionId}] Simplify1 stage completed: ${successful}/${tasks.length} successful`);
    this.simplify1Results = (simp1Results || []).filter(Boolean) as any;
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
    
    const tasks: Simplify2Task[] = this.simplify1Results.map((res, index) => ({
      taskId: `${this.sessionId}-simplify2-${index}`,
      sessionId: this.sessionId,
      type: 'simplify2',
      status: 'waiting',
      index,
      progress: 0,
      inputBufferId: res.outputBufferId,
      config: {
        algorithm: 'douglas-peucker',
        tolerance: this.config.simplifyTolerance || 0.001,
        preserveTopology: true,
        zoomLevel: (this.config.zoomLevels || [10])[0],
        quantization: 1e5,
        coordinatePrecision: 6,
      },
    }));
    
    let successful = 0;
    let failed = 0;
    const concurrency = Math.max(1, this.config.simplify2Workers || 1);
    const simp2Results = await this.batch.mapChunks(tasks, async (task) => {
      try {
        const res = await this.workerPool!.processSimplify2Task(task);
        successful++;
        return res;
      } catch {
        failed++;
      }
    }, {
      concurrency,
      progress: (completed) => {
        if (this.progressCallback) {
          this.progressCallback({
            sessionId: this.sessionId,
            stage: 'simplify2',
            total: tasks.length,
            completed,
            failed,
            percentage: (completed / tasks.length) * 100,
            currentTask: `Simplify2 (${completed}/${tasks.length})`,
          });
        }
      }
    });
    console.log(`[Session ${this.sessionId}] Simplify2 stage completed: ${successful}/${tasks.length} successful`);
    this.simplify2Results = (simp2Results || []).filter(Boolean) as any;
  }
  
  /**
   * Process vector tile generation stage
   */
  private async processVectorTileStage(): Promise<void> {
    if (!this.workerPool) {
      throw new Error('WorkerPool not initialized');
    }
    
    this.currentStage = 'vectorTiles';
    console.log(`[Session ${this.sessionId}] Processing vector tile stage`);
    
    const tileIds = this.simplify2Results.flatMap((r) => r.tileBufferIds || []);
    const tasks: VectorTileTask[] = tileIds.map((tileId, index) => {
      const m = tileId.match(/-(\d+)-(\d+)-(\d+)$/);
      const [z, x, y] = m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
      return {
        taskId: `${this.sessionId}-vectortile-${index}`,
        sessionId: this.sessionId,
        type: 'vectortile' as any,
        status: 'waiting',
        index,
        progress: 0,
        tileBufferId: tileId,
        config: {
          zoomLevel: z,
          tileX: x,
          tileY: y,
          extent: 4096,
          buffer: 256,
          layers: [],
          format: 'mvt',
          compression: true,
        },
      } as any;
    });
    
    let successful = 0;
    let failed = 0;
    const concurrency = Math.max(1, this.config.vectorTileWorkers || 1);
    await this.batch.mapChunks(tasks, async (task) => {
      try {
        await this.workerPool!.processVectorTileTask(task);
        successful++;
      } catch {
        failed++;
      }
    }, {
      concurrency,
      progress: (completed) => {
        if (this.progressCallback) {
          this.progressCallback({
            sessionId: this.sessionId,
            stage: 'vectortile',
            total: tasks.length,
            completed,
            failed,
            percentage: (completed / tasks.length) * 100,
            currentTask: `VectorTiles (${completed}/${tasks.length})`,
          });
        }
      }
    });
    console.log(`[Session ${this.sessionId}] Vector tile stage completed: ${successful}/${tasks.length} successful`);
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
    stage: BatchStage;
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
