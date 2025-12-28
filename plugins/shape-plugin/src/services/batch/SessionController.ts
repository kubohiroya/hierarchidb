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
import type { BatchProcessConfig } from './types.js';
import type { DownloadTaskPayload, ProgressInfo, ProcessingStage } from '../../common/types/index.js';
import { BatchTaskStage } from '../../common/types/index.js';
import type { DownloadTask } from '../../common/types/index.js';
import { isShapePreviewMetadataEnabled } from '../../common/config/previewFlags.js';
import { shapeDB } from '../database/ShapeDB.js';
import { getEphemeralShapeDB } from '../database/EphemeralShapeDB.js';
import type { DownloadStageOutput } from './strategies/DownloadStageStrategy.js';
import { resolveDownloadStageStrategy } from './strategies/resolveDownloadStageStrategy.js';
import { geojson as geojsonApi } from 'flatgeobuf';
import type { Feature, FeatureCollection } from 'geojson';
import { bbox as turfBbox } from '@turf/turf';

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
  private downloadTaskPayloads: DownloadTaskPayload[];
  private options: BatchSessionOptions;
  private config: BatchProcessConfig;
  private currentStage: ProcessingStage = 'download';
  private isPaused = false;
  private isAborted = false;
  private progressCallback?: (progress: ProgressInfo) => void;
  private simplify1Adapter?: Simplify1StageAdapter;
  private simplify2Adapter?: Simplify2StageAdapter;
  private vectorTileAdapter?: VectorTileStageAdapter;
  private simplify1Tasks: Simplify1Task[] = [];
  private simplify2Tasks: Simplify2Task[] = [];
  private readonly pausedStages = new Set<ProcessingStage>();
  private readonly stageWaiters = new Map<ProcessingStage, Array<() => void>>();
  private readonly stageAbortControllers = new Map<ProcessingStage, AbortController>();

  constructor(
    sessionId: string,
    nodeId: NodeId,
    downloadTaskPayloads: DownloadTaskPayload[],
    config: BatchProcessConfig,
    options: BatchSessionOptions = {},
  ) {
    this.sessionId = sessionId;
    this.nodeId = nodeId;
    this.downloadTaskPayloads = downloadTaskPayloads;
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

  private resolveDataSource(): string {
    const dataSource = this.config.dataSource ?? this.downloadTaskPayloads[0]?.dataSource;
    if (!dataSource) {
      throw new Error('Data source is required for batch processing');
    }
    return dataSource;
  }

  private async decodeFeatureCollection(buffer: ArrayBuffer): Promise<FeatureCollection | null> {
    const decoded = geojsonApi.deserialize(new Uint8Array(buffer));
    if (decoded && typeof (decoded as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
      const features: Feature[] = [];
      for await (const feature of decoded as AsyncIterable<Feature>) {
        if (feature) features.push(feature);
      }
      return { type: 'FeatureCollection', features };
    }
    if (this.isFeatureCollection(decoded)) {
      return decoded;
    }
    return null;
  }

  private isFeatureCollection(candidate: unknown): candidate is FeatureCollection {
    return Boolean(
      candidate
      && typeof candidate === 'object'
      && (candidate as FeatureCollection).type === 'FeatureCollection'
      && Array.isArray((candidate as FeatureCollection).features),
    );
  }

  private async encodeFeatureCollection(collection: FeatureCollection): Promise<ArrayBuffer> {
    const bytes = await geojsonApi.serialize(collection);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }

  private resolveFeatureLabel(feature: Feature, index: number, fallbackPrefix: string): string {
    const properties = feature.properties ?? {};
    const candidateKeys = [
      'name',
      'NAME',
      'Name',
      'adminName',
      'admin_name',
      'ADMIN_NAME',
      'admName',
      'ADM0_NAME',
      'ADM1_NAME',
      'ADM2_NAME',
      'shapeName',
      'SHAPE_NAME',
      'NAME_LONG',
    ];
    for (const key of candidateKeys) {
      const value = properties[key as keyof typeof properties];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    if (typeof feature.id === 'string' && feature.id.trim()) {
      return feature.id.trim();
    }
    return `${fallbackPrefix}-${index + 1}`;
  }

  private async expandOutputsForFeatureGroups(outputs: DownloadStageOutput[]): Promise<DownloadStageOutput[]> {
    const db = getEphemeralShapeDB();
    const expanded: DownloadStageOutput[] = [];
    for (const output of outputs) {
      const raw = await db.rawBuffers.get(output.inputBufferId);
      if (!raw) {
        expanded.push(output);
        continue;
      }
      const collection = await this.decodeFeatureCollection(raw.data);
      if (!collection || collection.features.length === 0) {
        expanded.push(output);
        continue;
      }
      const fallbackPrefix = output.adminLevel != null ? `ADM${output.adminLevel}` : 'feature';
      for (let index = 0; index < collection.features.length; index++) {
        const feature = collection.features[index];
        if (!feature) continue;
        const featureLabel = this.resolveFeatureLabel(feature, index, fallbackPrefix);
        const featureGroupId = String(
          (feature.properties as Record<string, unknown> | undefined)?.id ?? feature.id ?? index,
        );
        const featureCollection: FeatureCollection = { type: 'FeatureCollection', features: [feature] };
        const bufferId = `${output.inputBufferId}-feature-${index}`;
        const data = await this.encodeFeatureCollection(featureCollection);
        const bbox = turfBbox(featureCollection as unknown as FeatureCollection);
        await db.rawBuffers.put({
          id: bufferId,
          sessionId: raw.sessionId,
          nodeId: raw.nodeId,
          data,
          featureCount: 1,
          bbox: [bbox[0], bbox[1], bbox[2], bbox[3]],
          downloadTime: raw.downloadTime,
          size: data.byteLength,
          timestamp: Date.now(),
        });
        expanded.push({
          ...output,
          inputBufferId: bufferId,
          featureGroupId,
          featureLabel,
          featureIndex: index,
          featureCount: collection.features.length,
        });
      }
    }
    return expanded;
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
      const waitForResumeIfPaused = async () => {
        if (this.isPaused) {
          await this.waitForStageResume(this.currentStage);
        }
      };
      // Process each stage sequentially
      await this.processDownloadStage();
      await waitForResumeIfPaused();

      if (!this.isAborted && !this.isPaused) {
        await this.processSimplify1Stage();
      }
      await waitForResumeIfPaused();

      if (!this.isAborted && !this.isPaused) {
        await this.processSimplify2Stage();
      }
      await waitForResumeIfPaused();

      if (!this.isAborted && !this.isPaused) {
        await this.processVectorTileStage();
      }
      await waitForResumeIfPaused();

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

    const dataSource = this.resolveDataSource();
    const strategy = resolveDownloadStageStrategy(dataSource);
    const tasks: DownloadTask[] = await strategy.buildDownloadTasks({
      sessionId: this.sessionId,
      nodeId: this.nodeId,
      downloadTaskPayloads: this.downloadTaskPayloads,
      config: this.config,
      options: {
        timeoutMs: this.options.timeoutMs,
        retryAttempts: this.options.retryAttempts,
        retryDelay: this.options.retryDelay,
      },
    });
    const existingTaskIds = await this.assignDownloadTaskIndices(tasks);
    await this.registerTasks('download', tasks, existingTaskIds);
    const { runnableTasks, completedCount, failedCount, total } = await this.resolveStageTasks('download', tasks);
    const baseCompleted = Math.min(completedCount, total);
    const baseFailed = Math.min(failedCount, total - baseCompleted);
    const baseDone = Math.min(total, baseCompleted + baseFailed);
    if (baseDone > 0) {
      console.debug(`[Session ${this.sessionId}] Skipping completed download tasks`, {
        total,
        runnable: runnableTasks.length,
        completed: baseCompleted,
        failed: baseFailed,
      });
    }
    if (runnableTasks.length === 0) {
      this.progressCallback?.({
        total,
        completed: baseCompleted,
        failed: baseFailed,
        skipped: 0,
        percentage: total > 0 ? (baseDone / total) * 100 : 0,
        currentStage: 'download',
        currentTask: 'Download already completed',
      });
    } else {
      const reportProgress = (p: ProgressInfo) => {
        const completed = Math.min(total, baseCompleted + p.completed);
        const failed = Math.min(total - completed, baseFailed + p.failed);
        const skipped = p.skipped ?? 0;
        const done = Math.min(total, completed + failed + skipped);
        const percentage = total > 0 ? (done / total) * 100 : 0;
        this.progressCallback?.({
          ...p,
          total,
          completed,
          failed,
          skipped,
          percentage,
          currentStage: 'download',
        });
      };
      const maxConcurrent = this.config.downloadConfig?.maxConcurrent ?? this.options.maxConcurrentTasks;
      const res = await this.downloadAdapter.process(
        this.sessionId,
        this.nodeId,
        runnableTasks,
        reportProgress,
        {
          waitIfPaused: () => this.waitForStageResume('download'),
          getSignal: () => this.getStageAbortSignal('download'),
          maxConcurrent,
        },
      );
      const totalTasks = total;
      const processedTotal = baseCompleted + res.processed;
      const failedTotal = baseFailed + res.failed;
      const doneTotal = Math.min(totalTasks, processedTotal + failedTotal);
      console.log(`[Session ${this.sessionId}] Download stage completed: ${processedTotal} successful, ${failedTotal} failed`);
      const percentage = totalTasks > 0 ? (doneTotal / totalTasks) * 100 : 0;
      this.progressCallback?.({
        total: totalTasks,
        completed: processedTotal,
        failed: failedTotal,
        skipped: 0,
        percentage,
        currentStage: 'download',
        currentTask: 'Download completed',
      });
    }
    const postprocess = await strategy.postprocessDownloadOutputs({
      sessionId: this.sessionId,
      nodeId: this.nodeId,
      downloadTaskPayloads: this.downloadTaskPayloads,
      config: this.config,
      options: {
        timeoutMs: this.options.timeoutMs,
        retryAttempts: this.options.retryAttempts,
        retryDelay: this.options.retryDelay,
      },
      downloadTasks: tasks,
    });
    const expandedOutputs = await this.expandOutputsForFeatureGroups(postprocess.outputs);
    this.simplify1Tasks = this.buildSimplify1Tasks(expandedOutputs);
  }

  private buildSimplify1Tasks(outputs: DownloadStageOutput[]): Simplify1Task[] {
    const simplifyConfig = this.config.simplify1;
    const simplifyTolerance = this.config.simplify2?.simplify
      ?? this.config.simplify2?.tolerance
      ?? 0.001;
    const minArea = simplifyConfig?.featureAreaThreshold ?? 0;

    return outputs.map((output, index) => {
      const featureLabel = output.featureLabel ?? output.featureGroupId;
      const featureId = featureLabel ?? `${output.countryCode ?? 'UNK'}:${output.adminLevel ?? index}`;
      return {
      taskId: `${this.sessionId}-simplify1-${index}`,
      sessionId: this.sessionId as NodeId,
      taskType: 'simplify1',
      stage: BatchTaskStage.WAIT,
      type: 'simplify1',
      status: 'waiting',
      index,
      progress: 0,
      inputBufferId: output.inputBufferId,
      tolerance: simplifyTolerance,
      minArea,
      countryCode: output.countryCode,
      adminLevel: output.adminLevel,
      metadata: {
        dataSource: output.dataSource,
        countryName: output.countryName,
        sourceUrl: output.sourceUrl,
        featureLabel,
      },
      config: {
        sourceUrl: output.sourceUrl,
        featureId,
        featureLabel,
        featureGroupId: output.featureGroupId,
        featureIndex: output.featureIndex,
        countryCode: output.countryCode,
        adminLevel: output.adminLevel,
        algorithm: 'douglas-peucker',
        tolerance: simplifyTolerance,
        preserveTopology: true,
        minimumArea: minArea,
        featureFilterMethod: simplifyConfig?.featureFilterMethod,
        minVertexCountForAreaFilter: simplifyConfig?.minVertexCountForAreaFilter,
        aspectRatioThreshold: simplifyConfig?.aspectRatioThreshold,
        hybridFilterConfig: simplifyConfig?.hybridFilterConfig,
      },
      };
    });
  }

  /**
   * Process simplify1 stage
   */
  private async processSimplify1Stage(): Promise<void> {
    this.currentStage = 'simplify1';
    console.log(`[Session ${this.sessionId}] Processing simplify1 stage`);

    const tasks = this.simplify1Tasks;
    if (tasks.length === 0) {
      console.warn(`[Session ${this.sessionId}] No simplify1 tasks to process`);
      return;
    }

    await this.registerTasks('simplify1', tasks);
    const { runnableTasks, completedCount, failedCount, total } = await this.resolveStageTasks('simplify1', tasks);
    const baseCompleted = Math.min(completedCount, total);
    const baseFailed = Math.min(failedCount, total - baseCompleted);
    const baseDone = Math.min(total, baseCompleted + baseFailed);
    if (runnableTasks.length === 0) {
      this.progressCallback?.({
        total,
        completed: baseCompleted,
        failed: baseFailed,
        skipped: 0,
        percentage: total > 0 ? (baseDone / total) * 100 : 0,
        currentStage: 'simplify1',
        currentTask: 'Simplify1 already completed',
      });
      return;
    }
    const reportProgress = (p: ProgressInfo) => {
      const completed = Math.min(total, baseCompleted + p.completed);
      const failed = Math.min(total - completed, baseFailed + p.failed);
      const skipped = p.skipped ?? 0;
      const done = Math.min(total, completed + failed + skipped);
      const percentage = total > 0 ? (done / total) * 100 : 0;
      this.progressCallback?.({
        ...p,
        total,
        completed,
        failed,
        skipped,
        percentage,
        currentStage: 'simplify1',
      });
    };
    const maxConcurrent = this.config.simplify1Config?.workers ?? this.options.maxConcurrentTasks;
    const r = await this.simplify1Adapter!.process(runnableTasks, reportProgress, {
      waitIfPaused: () => this.waitForStageResume('simplify1'),
      getSignal: () => this.getStageAbortSignal('simplify1'),
      maxConcurrent,
    });
    console.log(
      `[Session ${this.sessionId}] Simplify1 stage completed: ${baseCompleted + r.processed}/${total} successful`,
    );
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

    const tasks: Simplify2Task[] = this.simplify1Tasks.map((task, index) => ({
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
      countryCode: task.countryCode,
      adminLevel: task.adminLevel,
      metadata: task.metadata,
      config: {
        sourceUrl: task.config?.sourceUrl,
        featureId: task.config?.featureId ?? `${task.countryCode ?? 'UNK'}:${task.adminLevel ?? index}`,
        featureLabel: task.config?.featureLabel,
        featureGroupId: task.config?.featureGroupId,
        featureIndex: task.config?.featureIndex,
        countryCode: task.countryCode,
        adminLevel: task.adminLevel,
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
    this.simplify2Tasks = tasks;
    if (tasks.length === 0) {
      console.warn(`[Session ${this.sessionId}] No simplify2 tasks to process`);
      return;
    }

    await this.registerTasks('simplify2', tasks);
    const { runnableTasks, completedCount, failedCount, total } = await this.resolveStageTasks('simplify2', tasks);
    const baseCompleted = Math.min(completedCount, total);
    const baseFailed = Math.min(failedCount, total - baseCompleted);
    const baseDone = Math.min(total, baseCompleted + baseFailed);
    if (runnableTasks.length === 0) {
      this.progressCallback?.({
        total,
        completed: baseCompleted,
        failed: baseFailed,
        skipped: 0,
        percentage: total > 0 ? (baseDone / total) * 100 : 0,
        currentStage: 'simplify2',
        currentTask: 'Simplify2 already completed',
      });
      return;
    }
    const reportProgress = (p: ProgressInfo) => {
      const completed = Math.min(total, baseCompleted + p.completed);
      const failed = Math.min(total - completed, baseFailed + p.failed);
      const skipped = p.skipped ?? 0;
      const done = Math.min(total, completed + failed + skipped);
      const percentage = total > 0 ? (done / total) * 100 : 0;
      this.progressCallback?.({
        ...p,
        total,
        completed,
        failed,
        skipped,
        percentage,
        currentStage: 'simplify2',
      });
    };
    const maxConcurrent = this.config.simplify2Config?.workers ?? this.options.maxConcurrentTasks;
    const r = await this.simplify2Adapter!.process(runnableTasks, reportProgress, {
      waitIfPaused: () => this.waitForStageResume('simplify2'),
      getSignal: () => this.getStageAbortSignal('simplify2'),
      maxConcurrent,
    });
    console.log(
      `[Session ${this.sessionId}] Simplify2 stage completed: ${baseCompleted + r.processed}/${total} successful`,
    );
  }

  private buildTileCoordinates(
    bbox: [number, number, number, number],
    zoomLevels: number[],
  ): Array<{ z: number; x: number; y: number }> {
    const [minLon, minLat, maxLon, maxLat] = bbox;
    const long2tile = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z);
    const lat2tile = (lat: number, z: number) => {
      const rad = (lat * Math.PI) / 180;
      return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
    };
    const tiles: Array<{ z: number; x: number; y: number }> = [];
    for (const z of zoomLevels) {
      const x1 = long2tile(minLon, z);
      const x2 = long2tile(maxLon, z);
      const y1 = lat2tile(maxLat, z);
      const y2 = lat2tile(minLat, z);
      for (let x = x1; x <= x2; x++) {
        for (let y = y1; y <= y2; y++) {
          tiles.push({ z, x, y });
        }
      }
    }
    return tiles;
  }

  private async buildVectorTileInputBuffer(): Promise<{
    inputBufferId: string;
    collection: FeatureCollection;
  } | null> {
    const db = getEphemeralShapeDB();
    const features: Feature[] = [];
    const hasValue = (value: unknown): boolean =>
      typeof value === 'string' ? value.trim().length > 0 : value != null;
    const applyFeatureMetadata = (
      feature: Feature,
      task: Simplify2Task,
    ) => {
      const properties = (feature.properties ??= {});
      const adminLevel = task.adminLevel;
      if (adminLevel != null && !hasValue(properties.adminLevel) && !hasValue(properties.admin_level) && !hasValue(properties.ADM_LEVEL)) {
        properties.adminLevel = adminLevel;
      }
      const countryCode = task.countryCode;
      if (countryCode && !hasValue(properties.ISO_A3) && !hasValue(properties.ISO3) && !hasValue(properties.ADM0_A3)) {
        properties.ISO_A3 = countryCode;
        properties.ISO3 = countryCode;
      }
      const countryName = task.metadata?.countryName;
      if (countryName && !hasValue(properties.COUNTRY_NAME) && !hasValue(properties.COUNTRY) && !hasValue(properties.NAME_0)) {
        properties.COUNTRY_NAME = countryName;
      }
    };
    for (const task of this.simplify2Tasks) {
      const bufferId = task.inputBufferId ?? task.config?.inputBufferId;
      if (!bufferId) continue;
      const input = await db.simplifiedBuffers.get(bufferId)
        ?? await db.rawBuffers.get(bufferId);
      if (!input) continue;
      const decoded = await this.decodeFeatureCollection(input.data);
      if (!decoded) continue;
      decoded.features.forEach((feature) => applyFeatureMetadata(feature, task));
      features.push(...decoded.features);
    }
    if (features.length === 0) {
      return null;
    }
    const collection: FeatureCollection = { type: 'FeatureCollection', features };
    const mergedId = `${this.sessionId}-simplify2-merged`;
    const data = await this.encodeFeatureCollection(collection);
    await db.simplifiedBuffers.put({
      id: mergedId,
      sessionId: this.sessionId,
      nodeId: this.nodeId,
      stage: 'simplify2',
      data,
      featureCount: features.length,
      simplificationRatio: 1,
      tolerance: this.config.simplify2?.tolerance ?? 0,
      timestamp: Date.now(),
    });
    return { inputBufferId: mergedId, collection };
  }

  private buildVectorTileTasks(
    inputBufferId: string,
    collection: FeatureCollection,
  ): VectorTileTask[] {
    const tileSize = this.config.vectorTiles?.tileSize ?? this.config.tileSize ?? 256;
    const buffer = this.config.vectorTiles?.bufferSize ?? 256;
    const minZoom = this.config.vectorTiles?.minZoom ?? 0;
    const maxZoom = this.config.vectorTiles?.maxZoom ?? 10;
    const zoomLevels = this.resolveZoomLevels();
    const metadataEnabled = isShapePreviewMetadataEnabled();
    const dataSource = this.resolveDataSource();
    const bbox = turfBbox(collection);
    if (!bbox.every((value: number) => Number.isFinite(value))) {
      return [];
    }
    const tiles = this.buildTileCoordinates([bbox[0], bbox[1], bbox[2], bbox[3]], zoomLevels);
    return tiles.map((tile, index) => ({
      taskId: `${this.sessionId}-vectortile-${index}`,
      sessionId: this.sessionId as NodeId,
      taskType: 'vectortile',
      stage: BatchTaskStage.WAIT,
      type: 'vectortile',
      status: 'waiting',
      index,
      progress: 0,
      zoomLevel: tile.z,
      config: {
        inputBufferId,
        minZoom,
        maxZoom,
        tileZ: tile.z,
        tileX: tile.x,
        tileY: tile.y,
        extent: 4096,
        buffer,
        tileSize,
        layers: [],
        format: 'mvt',
        compression: true,
        metadataEnabled,
        metadataContext: { dataSource },
      },
    }));
  }

  /**
   * Process vector tile generation stage
   */
  private async processVectorTileStage(): Promise<void> {
    this.currentStage = 'vectortile';
    console.log(`[Session ${this.sessionId}] Processing vector tile stage`);

    const merged = await this.buildVectorTileInputBuffer();
    if (!merged) {
      console.warn(`[Session ${this.sessionId}] No vector tile inputs to process`);
      return;
    }
    const tasks = this.buildVectorTileTasks(merged.inputBufferId, merged.collection);
    if (tasks.length === 0) {
      console.warn(`[Session ${this.sessionId}] No vector tile tasks to process`);
      return;
    }

    await this.registerTasks('vectortile', tasks);
    const { runnableTasks, completedCount, failedCount, total } = await this.resolveStageTasks('vectortile', tasks);
    const baseCompleted = Math.min(completedCount, total);
    const baseFailed = Math.min(failedCount, total - baseCompleted);
    const baseDone = Math.min(total, baseCompleted + baseFailed);
    if (runnableTasks.length === 0) {
      this.progressCallback?.({
        total,
        completed: baseCompleted,
        failed: baseFailed,
        skipped: 0,
        percentage: total > 0 ? (baseDone / total) * 100 : 0,
        currentStage: 'vectortile',
        currentTask: 'Vector tiles already completed',
      });
      return;
    }
    const reportProgress = (p: ProgressInfo) => {
      const completed = Math.min(total, baseCompleted + p.completed);
      const failed = Math.min(total - completed, baseFailed + p.failed);
      const skipped = p.skipped ?? 0;
      const done = Math.min(total, completed + failed + skipped);
      const percentage = total > 0 ? (done / total) * 100 : 0;
      this.progressCallback?.({
        ...p,
        total,
        completed,
        failed,
        skipped,
        percentage,
        currentStage: 'vectortile',
      });
    };
    const maxConcurrent = this.config.tileConfig?.workers ?? this.options.maxConcurrentTasks;
    const r = await this.vectorTileAdapter!.process(runnableTasks, reportProgress, {
      waitIfPaused: () => this.waitForStageResume('vectortile'),
      getSignal: () => this.getStageAbortSignal('vectortile'),
      maxConcurrent,
    });
    console.log(
      `[Session ${this.sessionId}] Vector tile stage completed: ${baseCompleted + r.processed}/${total} successful`,
    );
  }

  /**
   * Set progress callback
   */
  setProgressCallback(callback: (progress: ProgressInfo) => void): void {
    this.progressCallback = callback;
  }

  pauseStage(stage: ProcessingStage): void {
    this.pausedStages.add(stage);
    this.isPaused = true;
    this.abortStageController(stage);
  }

  resumeStage(stage: ProcessingStage): void {
    if (!this.pausedStages.delete(stage)) return;
    this.resetStageAbortController(stage);
    this.resolveStageWaiters(stage);
    if (this.pausedStages.size === 0) {
      this.isPaused = false;
    }
  }

  resumeAllStages(): void {
    for (const stage of [...this.pausedStages]) {
      this.pausedStages.delete(stage);
      this.resetStageAbortController(stage);
      this.resolveStageWaiters(stage);
    }
    this.isPaused = false;
  }

  private getStageAbortSignal(stage: ProcessingStage): AbortSignal {
    const existing = this.stageAbortControllers.get(stage);
    if (existing) return existing.signal;
    const controller = new AbortController();
    this.stageAbortControllers.set(stage, controller);
    return controller.signal;
  }

  private resetStageAbortController(stage: ProcessingStage): void {
    this.stageAbortControllers.set(stage, new AbortController());
  }

  private abortStageController(stage: ProcessingStage): void {
    const controller = this.stageAbortControllers.get(stage);
    if (controller && !controller.signal.aborted) {
      controller.abort();
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

  private async registerTasks(
    stage: ProcessingStage,
    tasks: Array<{ taskId: string; config?: unknown; index?: number }>,
    existingTaskIds?: Set<string>,
  ): Promise<void> {
    const existingIds = existingTaskIds ?? new Set(
      (await shapeDB.batchTasks
        .where('sessionId')
        .equals(this.sessionId)
        .and((task) => task.taskType === stage)
        .toArray())
        .map((task) => task.taskId),
    );
    const newTasks = tasks
      .filter((task) => !existingIds.has(task.taskId))
      .map((task, index) => ({
        taskId: task.taskId,
        sessionId: this.sessionId,
        taskType: stage,
        status: 'waiting' as const,
        index: task.index ?? index,
        progress: 0,
        inputData: typeof task.config === 'object' && task.config ? (task.config as Record<string, unknown>) : undefined,
      }));
    if (newTasks.length > 0) {
      await shapeDB.batchTasks.bulkPut(newTasks);
    }
  }

  private async resolveStageTasks<T extends { taskId: string }>(
    stage: ProcessingStage,
    tasks: T[],
  ): Promise<{ runnableTasks: T[]; completedCount: number; failedCount: number; total: number }> {
    const existing = await shapeDB.batchTasks
      .where('sessionId')
      .equals(this.sessionId)
      .and((task) => task.taskType === stage)
      .toArray();
    const statusById = new Map(existing.map((task) => [task.taskId, task.status]));
    const runnableTasks = tasks.filter((task) => {
      const status = statusById.get(task.taskId);
      return status !== 'completed' && status !== 'failed' && status !== 'cancelled';
    });
    const completedCount = existing.filter((task) => task.status === 'completed').length;
    const failedCount = existing.filter((task) => task.status === 'failed' || task.status === 'cancelled').length;
    return { runnableTasks, completedCount, failedCount, total: tasks.length };
  }

  private async assignDownloadTaskIndices(tasks: DownloadTask[]): Promise<Set<string>> {
    const existing = await shapeDB.batchTasks
      .where('sessionId')
      .equals(this.sessionId)
      .and((task) => task.taskType === 'download')
      .toArray();
    const existingIds = new Set(existing.map((task) => task.taskId));
    const existingIndexById = new Map(existing.map((task) => [task.taskId, task.index]));
    let nextIndex = existing.reduce((max, task) => Math.max(max, task.index ?? 0), -1) + 1;
    tasks.forEach((task) => {
      const existingIndex = existingIndexById.get(task.taskId);
      if (existingIndex != null) {
        task.index = existingIndex;
        return;
      }
      task.index = nextIndex;
      nextIndex += 1;
    });
    return existingIds;
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
