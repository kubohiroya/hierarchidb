/**
 * SessionController - Manages a single batch processing session with its own WorkerPool
 *
 * Features:
 * - Owns and manages WorkerPoolManager lifecycle
 * - Handles session state and progress tracking
 * - Coordinates task execution across stages
 * - Ensures proper cleanup on completion/abort
 */

import type { NodeId } from '@hierarchidb/common-types';
import type { DownloadStageAdapter } from './adapters/DownloadStageAdapter.js';
import { RuntimeWorkerDownloadAdapter } from './adapters/RuntimeWorkerDownloadAdapter.js';
import type { Simplify1Task, Simplify2Task, VectorTileTask } from '../../common/types/index.js';
import type { Simplify1StageAdapter } from './adapters/Simplify1StageAdapter.js';
import type { Simplify2StageAdapter } from './adapters/Simplify2StageAdapter.js';
import type { VectorTileStageAdapter } from './adapters/VectorTileStageAdapter.js';
import { LocalSimplify1Adapter, LocalSimplify2Adapter } from './adapters/LocalSimplifyAdapters.js';
import { RuntimeWorkerVectorTileAdapter } from './adapters/RuntimeWorkerVectorTileAdapter.js';
import { getShapeRuntimeWorkerClient } from './adapters/RuntimeWorkerClient.js';
import type { BatchProcessConfig } from './types.js';
import type { UrlMetadata, ProgressInfo, ProcessingStage } from '../../common/types/index.js';
import { BatchTaskStage } from '../../common/types/index.js';
import type { DownloadTask } from '../../common/types/index.js';
import { isShapePreviewMetadataEnabled } from '../../common/config/previewFlags.js';
import { shapeDB } from '../database/ShapeDB.js';

type WorkerPoolStatistics = Record<string, number>;

interface WorkerPoolHandle {
  shutdown(): Promise<void>;
  getPoolStatistics(): WorkerPoolStatistics;
}

export interface BatchSessionOptions {
  maxConcurrentTasks?: number;
  retryAttempts?: number;
  retryDelay?: number;
  timeoutMs?: number;
  enableResourceTracking?: boolean;
}

export class SessionController {
  public readonly sessionId: string;
  private nodeId: NodeId;
  private workerPool: WorkerPoolHandle | null = null;
  private downloadAdapter: DownloadStageAdapter = new RuntimeWorkerDownloadAdapter();
  private urlMetadata: UrlMetadata[];
  private options: BatchSessionOptions;
  private config: BatchProcessConfig;
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
    this.options = options;
    this.config = config;
  }

  private resolveZoomLevels(): number[] {
    const minZoom = this.config.vectorTiles?.minZoom ?? 0;
    const maxZoom = this.config.vectorTiles?.maxZoom ?? minZoom;
    const lower = Math.min(minZoom, maxZoom);
    const upper = Math.max(minZoom, maxZoom);
    if (!Number.isFinite(lower) || !Number.isFinite(upper)) {
      return [];
    }
    return Array.from({ length: upper - lower + 1 }, (_, index) => lower + index);
  }

  /**
   * Initialize the session by creating a new WorkerPool
   */
  async initialize(): Promise<void> {
    if (this.workerPool) {
      throw new Error(`Session ${this.sessionId} already initialized`);
    }

    // Prefer runtime-worker-worker adapters when a client is available; otherwise optionally fall back to WorkerPool-backed ones
    this.simplify1Adapter = new LocalSimplify1Adapter();
    this.simplify2Adapter = new LocalSimplify2Adapter();
    const client = await getShapeRuntimeWorkerClient();
    if (!client) {
      throw new Error('Shape runtime-worker worker unavailable. Legacy WorkerPool fallback has been removed.');
    }
    this.vectorTileAdapter = new RuntimeWorkerVectorTileAdapter();
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
      sessionId: this.sessionId as NodeId,
      taskType: 'download',
      stage: BatchTaskStage.WAIT,
      type: 'download',
      status: 'waiting',
      index,
      progress: 0,
      url: metadata.url,
        config: {
          dataSource: (metadata as { dataSource?: string }).dataSource ?? metadata.continent ?? 'gadm',
          country: (metadata as { country?: string }).country ?? metadata.countryCode ?? 'UNKNOWN',
          adminLevel: metadata.adminLevel,
          url: metadata.url,
        timeoutMs: this.options.timeoutMs ?? 0,
        retryDelay: this.options.retryDelay ?? 0,
        retryAttempts: this.options.retryAttempts ?? 0,
        expectedFormat: 'geojson',
        validateSSL: true,
        },
    }));
    await this.registerTasks('download', tasks);
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

    const simplifyConfig = this.config.simplify1;
    const simplifyTolerance = this.config.simplify2?.simplify
      ?? this.config.simplify2?.tolerance
      ?? 0.001;
    const minArea = simplifyConfig?.featureAreaThreshold ?? 0;

    const tasks: Simplify1Task[] = this.urlMetadata.map((_metadata, index) => ({
      taskId: `${this.sessionId}-simplify1-${index}`,
      sessionId: this.sessionId as NodeId,
      taskType: 'simplify1',
      stage: BatchTaskStage.WAIT,
      type: 'simplify1',
      status: 'waiting',
      index,
      progress: 0,
      inputBufferId: `${this.sessionId}-download-${index}`,
      tolerance: simplifyTolerance,
      minArea,
      config: {
        algorithm: 'douglas-peucker',
        tolerance: simplifyTolerance,
        preserveTopology: true,
        minimumArea: minArea,
        featureFilterMethod: simplifyConfig?.featureFilterMethod,
        minVertexCountForAreaFilter: simplifyConfig?.minVertexCountForAreaFilter,
        aspectRatioThreshold: simplifyConfig?.aspectRatioThreshold,
        hybridFilterConfig: simplifyConfig?.hybridFilterConfig,
      },
    }));

    await this.registerTasks('simplify1', tasks);
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

    const zoomLevels = this.resolveZoomLevels();
    const tileSize = this.config.vectorTiles?.tileSize ?? this.config.tileSize ?? 512;
    const simplify2Config = this.config.simplify2;

    const tasks: Simplify2Task[] = this.urlMetadata.map((_metadata, index) => ({
      taskId: `${this.sessionId}-simplify2-${index}`,
      sessionId: this.sessionId as NodeId,
      taskType: 'simplify2',
      stage: BatchTaskStage.WAIT,
      type: 'simplify2',
      status: 'waiting',
      index,
      progress: 0,
      inputBufferId: `${this.sessionId}-simplify1-${index}`,
      zoomLevels,
      tileSize,
      config: {
        zoomLevel: zoomLevels[0] ?? 10,
        tileSize,
        preserveSharedBoundaries: true,
        quantize: simplify2Config?.quantize,
        algorithm: 'douglas-peucker',
        tolerance: simplify2Config?.tolerance,
        minimumArea: simplify2Config?.simplify,
        preserveTopology: true,
        maxVertices: undefined,
        coordinatePrecision: 6,
        enablePerFeatureSimplification: simplify2Config?.enablePerFeatureSimplification,
      },
    }));

    await this.registerTasks('simplify2', tasks);
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

    const tileSize = this.config.vectorTiles?.tileSize ?? this.config.tileSize ?? 256;
    const buffer = this.config.vectorTiles?.bufferSize ?? 256;
    const minZoom = this.config.vectorTiles?.minZoom ?? 0;
    const maxZoom = this.config.vectorTiles?.maxZoom ?? 10;
    const metadataEnabled = isShapePreviewMetadataEnabled();
    let metadataReplace = true;
    const tasks: VectorTileTask[] = this.urlMetadata.map((metadata, index) => {
      const replace = metadataEnabled && metadataReplace;
      if (metadataEnabled) {
        metadataReplace = false;
      }
      return {
        taskId: `${this.sessionId}-vectortile-${index}`,
        sessionId: this.sessionId as NodeId,
        taskType: 'vectortile',
        stage: BatchTaskStage.WAIT,
        type: 'vectortile',
        status: 'waiting',
        index,
        progress: 0,
        countryCode: metadata.countryCode,
        adminLevel: metadata.adminLevel,
        config: {
          inputBufferId: `${this.sessionId}-simplify2-${index}`,
          minZoom,
          maxZoom,
          tileX: 0,
          tileY: 0,
          extent: 4096,
          buffer,
          tileSize,
          layers: [],
          format: 'mvt',
          compression: true,
          metadataEnabled,
          metadataReplace: replace,
          metadataContext: {
            dataSource: metadata.dataSource,
            countryCode: metadata.countryCode,
            countryName: metadata.countryName,
            adminLevel: metadata.adminLevel,
          },
        },
      };
    });

    await this.registerTasks('vectortile', tasks);
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

  private async registerTasks(stage: ProcessingStage, tasks: Array<{ taskId: string; config?: unknown }>): Promise<void> {
    await Promise.all(tasks.map((task, index) => shapeDB.createBatchTask({
      taskId: task.taskId,
      sessionId: this.sessionId,
      taskType: stage,
      status: 'waiting',
      index,
      progress: 0,
      inputData: typeof task.config === 'object' && task.config ? (task.config as Record<string, unknown>) : undefined,
    })));
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
  getPoolStatistics(): WorkerPoolStatistics | null {
    if (!this.workerPool) {
      return null;
    }
    return this.workerPool.getPoolStatistics();
  }
}
