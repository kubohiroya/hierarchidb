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
import { ShapeWorkerSimplify1Adapter, ShapeWorkerSimplify2Adapter } from './adapters/ShapeWorkerSimplifyAdapters.js';
import { RuntimeWorkerVectorTileAdapter } from './adapters/RuntimeWorkerVectorTileAdapter.js';
import type { BatchProcessConfig } from './types.js';
import type { DownloadTaskPayload, ProgressInfo, ProcessingStage } from '../../common/types/index.js';
import { BatchTaskStage } from '../../common/types/index.js';
import type { DownloadTask } from '../../common/types/index.js';
import { isShapePreviewMetadataEnabled } from '../../common/config/previewFlags.js';
import { shapeDB, type BatchTaskRecord, type VectorTileRecord } from '../database/ShapeDB.js';
import { getEphemeralShapeDB } from '../database/EphemeralShapeDB.js';
import { getShapeTileMetadataDB, type ShapeSourceMetadataRow } from '../database/ShapeTileMetadataDB.js';
import type { DownloadStageOutput } from './strategies/DownloadStageStrategy.js';
import { resolveDownloadStageStrategy } from './strategies/resolveDownloadStageStrategy.js';
import { geojson as geojsonApi } from 'flatgeobuf';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { bbox as turfBbox, area as turfArea } from '@turf/turf';
import { TilesDB } from '@hierarchidb/gis-sdk';
import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
import { HDB_ORIGIN_KEY } from './utils/featureIds.js';

type WorkerPoolStatistics = Record<string, number>;

type GeometryStatsSummary = {
  vertexCount: number;
  polygonCount: number;
  bbox?: [number, number, number, number];
};

type OriginMetadata = {
  originKey: string;
  originLabel: string;
  inputBufferId: string;
  dataSource?: string;
  countryName?: string;
  countryCode?: string;
  adminLevel?: number;
  featureGroupId?: string;
  featureLabel?: string;
};

const isSkippedMessage = (message?: string | null): boolean => {
  if (!message) return false;
  const normalized = message.trim().toLowerCase();
  return normalized === 'skipped' || normalized.startsWith('skipped:');
};

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
  private simplify2RetryOverride = 0;
  private readonly pausedStages = new Set<ProcessingStage>();
  private readonly stageWaiters = new Map<ProcessingStage, Array<() => void>>();
  private readonly stageAbortControllers = new Map<ProcessingStage, AbortController>();
  private readonly pauseRequestedStages = new Set<ProcessingStage>();
  private pauseHandler?: (stage: ProcessingStage, message: string) => void | Promise<void>;
  private lastTileIndexStats?: {
    totalTiles: number;
    acceptedTiles: number;
    skippedSerialization: number;
    skippedSize: number;
  };
  private originMetadataByKey = new Map<string, OriginMetadata>();
  private originMetadataByBuffer = new Map<string, OriginMetadata>();

  constructor(
    nodeId: NodeId,
    downloadTaskPayloads: DownloadTaskPayload[],
    config: BatchProcessConfig,
    options: BatchSessionOptions = {},
  ) {
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

  private async calculateTileHash(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data as ArrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  private async syncVectorTilesToShapeDb(): Promise<void> {
    const nodeKey = String(this.nodeId);
    const tilesDb = await TilesDB.getSingleton();
    const tiles = await tilesDb.tiles.where('nodeId').equals(nodeKey).toArray();
    if (tiles.length === 0) return;
    const records = await Promise.all(tiles
      .filter((row) => row.contentType === 'application/vnd.mapbox-vector-tile' && row.data)
      .map(async (row) => {
        const data = row.data instanceof Uint8Array ? row.data : new Uint8Array(row.data);
        const contentHash = await this.calculateTileHash(data);
        return {
          tileId: `${nodeKey}-${row.z}-${row.x}-${row.y}`,
          nodeId: this.nodeId,
          z: row.z,
          x: row.x,
          y: row.y,
          data_Uint8Array: data,
          size: row.size,
          features: 0,
          layers: [],
          generatedAt: row.timestamp,
          contentHash,
          version: 1,
        } satisfies VectorTileRecord;
      }));
    if (records.length > 0) {
      await shapeDB.vectorTiles.bulkPut(records);
    }
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

  private normalizeTaskIdSegment(value: string): string {
    const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return normalized.replace(/^-+|-+$/g, '') || 'unknown';
  }

  private buildProcessingTaskId(
    stage: 'simplify1' | 'simplify2',
    details: {
      countryCode?: string;
      adminLevel?: number;
      featureLabel?: string;
      featureGroupId?: string;
    },
  ): string {
    const countrySegment = this.normalizeTaskIdSegment(details.countryCode ?? 'UNK');
    const adminSegment = Number.isFinite(details.adminLevel)
      ? `adm${details.adminLevel}`
      : 'adm-unknown';
    const featureSegments = [details.featureLabel, details.featureGroupId]
      .flatMap((value) => {
        if (typeof value === 'number') return [String(value)];
        if (typeof value === 'string') return [value];
        return [];
      })
      .map((value) => this.normalizeTaskIdSegment(value))
      .filter(Boolean);
    const uniqueFeatureSegments = Array.from(new Set(featureSegments));
    const featureSegment = uniqueFeatureSegments.length > 0 ? uniqueFeatureSegments.join('-') : 'all';
    return `${this.nodeId}+${countrySegment}+${adminSegment}+${featureSegment}+${stage}`;
  }

  private resolveTaskIdDetails(task: {
    countryCode?: string;
    adminLevel?: number;
    metadata?: Record<string, unknown>;
    config?: {
      featureLabel?: string;
      featureGroupId?: string;
    };
  }): {
    countryCode?: string;
    adminLevel?: number;
    featureLabel?: string;
    featureGroupId?: string;
  } {
    const metadata = task.metadata ?? {};
    return {
      countryCode: task.countryCode,
      adminLevel: task.adminLevel,
      featureLabel: task.config?.featureLabel
        ?? (typeof metadata.featureLabel === 'string' ? metadata.featureLabel : undefined),
      featureGroupId: task.config?.featureGroupId
        ?? (typeof metadata.featureGroupId === 'string' ? metadata.featureGroupId : undefined),
    };
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
      throw new Error(`Session ${this.nodeId} already initialized`);
    }

    // Use shape-stage workers for download/simplify and runtime-worker for vector tiles.
    this.simplify1Adapter = new ShapeWorkerSimplify1Adapter();
    this.simplify2Adapter = new ShapeWorkerSimplify2Adapter();
    this.vectorTileAdapter = new RuntimeWorkerVectorTileAdapter();
  }

  setPauseHandler(handler?: (stage: ProcessingStage, message: string) => void | Promise<void>): void {
    this.pauseHandler = handler;
  }

  private async requestPause(stage: ProcessingStage, message: string): Promise<void> {
    if (this.pauseRequestedStages.has(stage)) return;
    this.pauseRequestedStages.add(stage);
    this.pauseStage(stage);
    await this.pauseHandler?.(stage, message);
  }

  /**
   * Start processing the batch session
   */
  async start(): Promise<void> {
    if (!this.workerPool) {
      await this.initialize();
    }

    console.log(`[Session ${this.nodeId}] Starting batch processing`);

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

      let regressionRounds = 0;
      while (!this.isAborted && !this.isPaused) {
        const retry = await this.getVectorTileRegressionRetry();
        if (retry == null) break;
        regressionRounds += 1;
        if (regressionRounds > 2) {
          console.warn(`[Session ${this.nodeId}] Regression retry limit reached; skipping further retries.`);
          break;
        }
        console.warn(
          `[Session ${this.nodeId}] Vector tile regression detected (retry=${retry}); restarting simplify2.`,
        );
        await this.prepareSimplify2Retry(retry);
        await this.processSimplify2Stage();
        await waitForResumeIfPaused();
        if (this.isAborted || this.isPaused) break;
        await this.processVectorTileStage();
        await waitForResumeIfPaused();
      }
      this.simplify2RetryOverride = 0;

      if (!this.isAborted && !this.isPaused) {
        console.log(`[Session ${this.nodeId}] Batch processing completed successfully`);
      }
    } catch (error) {
      console.error(`[Session ${this.nodeId}] Batch processing failed:`, error);
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
    console.log(`[Session ${this.nodeId}] Session paused`);
    // Note: We keep the WorkerPool alive for resume
  }

  /**
   * Resume the session
   */
  async resume(): Promise<void> {
    if (!this.isPaused) {
      throw new Error(`Session ${this.nodeId} is not paused`);
    }

    this.isPaused = false;
    console.log(`[Session ${this.nodeId}] Session resumed`);
    this.resumeAllStages();

    // Continue from current stage
    await this.start();
  }

  /**
   * Abort the session and cleanup resources
   */
  async abort(): Promise<void> {
    this.isAborted = true;
    console.log(`[Session ${this.nodeId}] Session aborted`);
    this.resumeAllStages();
    await this.cleanup();
  }

  /**
   * Cleanup resources (terminates WorkerPool)
   */
  private async cleanup(): Promise<void> {
    if (this.workerPool) {
      console.log(`[Session ${this.nodeId}] Shutting down WorkerPool`);
      await this.workerPool.shutdown();
      this.workerPool = null;
      console.log(`[Session ${this.nodeId}] WorkerPool terminated`);
    }
    this.resumeAllStages();
  }

  /**
   * Process download stage
   */
  private async processDownloadStage(): Promise<void> {
    this.currentStage = 'download';
    console.log(`[Session ${this.nodeId}] Processing download stage`);

    const dataSource = this.resolveDataSource();
    const strategy = resolveDownloadStageStrategy(dataSource);
    const tasks: DownloadTask[] = await strategy.buildDownloadTasks({
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
      console.debug(`[Session ${this.nodeId}] Skipping completed download tasks`, {
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
      const maxConcurrent = this.config.download?.concurrentDownloads ?? this.options.maxConcurrentTasks;
      const res = await this.downloadAdapter.process(
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
      console.log(`[Session ${this.nodeId}] Download stage completed: ${processedTotal} successful, ${failedTotal} failed`);
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
    if (isShapePreviewMetadataEnabled()) {
      const originEntries = this.indexOriginMetadata(expandedOutputs);
      await this.updateSourceMetadataBase(originEntries);
      const db = getEphemeralShapeDB();
      const rawStatsByOrigin = new Map<string, GeometryStatsSummary>();
      for (const entry of originEntries) {
        const raw = await db.rawBuffers.get(entry.inputBufferId);
        if (!raw) continue;
        const stats = await this.summarizeBufferStats(raw.data);
        const existing = rawStatsByOrigin.get(entry.originKey) ?? { vertexCount: 0, polygonCount: 0 };
        rawStatsByOrigin.set(entry.originKey, this.accumulateStats(existing, stats));
      }
      await this.updateSourceMetadataStage('raw', rawStatsByOrigin);
    } else {
      this.indexOriginMetadata(expandedOutputs);
    }
    this.simplify1Tasks = this.buildSimplify1Tasks(expandedOutputs);
  }

  private buildSimplify1Tasks(outputs: DownloadStageOutput[]): Simplify1Task[] {
    const simplifyConfig = this.config.simplify1;
    const simplifyTolerance = this.config.simplify2?.simplify
      ?? this.config.simplify2?.tolerance
      ?? 0.001;
    const minArea = simplifyConfig?.featureAreaThreshold ?? 0;

    return outputs.map((output, index) => {
      const origin = this.originMetadataByBuffer.get(output.inputBufferId) ?? this.buildOriginMetadata(output);
      const featureLabel = output.featureLabel ?? output.featureGroupId;
      const featureId = featureLabel
        ?? output.featureGroupId
        ?? `${output.countryCode ?? 'UNK'}:ADM${output.adminLevel ?? 'X'}`;
      const taskId = this.buildProcessingTaskId('simplify1', {
        countryCode: output.countryCode,
        adminLevel: output.adminLevel,
        featureLabel,
        featureGroupId: output.featureGroupId,
      });
      return {
        taskId,
        nodeId: this.nodeId,
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
          featureIndex: output.featureIndex,
          featureCount: output.featureCount,
          originKey: origin.originKey,
          originLabel: origin.originLabel,
        },
        config: {
          sourceUrl: output.sourceUrl,
          featureId,
          featureLabel,
          featureGroupId: output.featureGroupId,
          featureIndex: output.featureIndex,
          originKey: origin.originKey,
          originLabel: origin.originLabel,
          countryCode: output.countryCode,
          adminLevel: output.adminLevel,
          algorithm: 'douglas-peucker',
          tolerance: simplifyTolerance,
          preserveTopology: true,
          minimumArea: minArea,
          enableFeatureFiltering: simplifyConfig?.enableFeatureFiltering ?? true,
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
    console.log(`[Session ${this.nodeId}] Processing simplify1 stage`);

    const tasks = this.simplify1Tasks;
    if (tasks.length === 0) {
      console.warn(`[Session ${this.nodeId}] No simplify1 tasks to process`);
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
    const maxConcurrent = this.config.simplify1?.concurrentProcesses ?? this.options.maxConcurrentTasks;
    const r = await this.simplify1Adapter!.process(runnableTasks, reportProgress, {
      waitIfPaused: () => this.waitForStageResume('simplify1'),
      getSignal: () => this.getStageAbortSignal('simplify1'),
      maxConcurrent,
    });
    console.log(
      `[Session ${this.nodeId}] Simplify1 stage completed: ${baseCompleted + r.processed}/${total} successful`,
    );
    if (isShapePreviewMetadataEnabled()) {
      const db = getEphemeralShapeDB();
      const statsByOrigin = new Map<string, GeometryStatsSummary>();
      for (const task of this.simplify1Tasks) {
        const originKey = this.getOriginKeyFromTask(task);
        if (!originKey) continue;
        const bufferId = `${this.nodeId}-simplify1-${task.index ?? 0}`;
        const buffer = await db.simplifiedBuffers.get(bufferId);
        if (!buffer) continue;
        const stats = await this.summarizeBufferStats(buffer.data);
        const existing = statsByOrigin.get(originKey) ?? { vertexCount: 0, polygonCount: 0 };
        statsByOrigin.set(originKey, this.accumulateStats(existing, stats));
      }
      await this.updateSourceMetadataStage('simplify1', statsByOrigin);
    }
  }

  /**
   * Process simplify2 stage
   */
  private async processSimplify2Stage(): Promise<void> {
    this.currentStage = 'simplify2';
    console.log(`[Session ${this.nodeId}] Processing simplify2 stage`);

    const zoomLevels = this.resolveZoomLevels();
    const tileSize = this.config.vectorTiles?.tileSize ?? this.config.tileSize ?? 512;
    const simplify2Config = this.config.simplify2;
    const simplificationMode = 'topojson';
    const retry = this.simplify2RetryOverride ?? 0;

    const tasks: Simplify2Task[] = this.simplify1Tasks.map((task, index) => {
      const originKey = this.getOriginKeyFromTask(task);
      const metadata = task.metadata ?? {};
      const originLabel = typeof metadata.originLabel === 'string' ? metadata.originLabel : undefined;
      return ({
        taskId: this.buildProcessingTaskId('simplify2', this.resolveTaskIdDetails(task)),
        nodeId: this.nodeId,
        taskType: 'simplify2',
        stage: BatchTaskStage.WAIT,
        type: 'simplify2',
        status: 'waiting',
        index,
        progress: 0,
        inputBufferId: `${this.nodeId}-simplify1-${index}`,
        zoomLevels,
        tileSize,
        countryCode: task.countryCode,
        adminLevel: task.adminLevel,
        metadata: task.metadata,
        config: {
          sourceTaskId: task.taskId,
          sourceUrl: task.config?.sourceUrl,
          featureId: task.config?.featureId ?? `${task.countryCode ?? 'UNK'}:ADM${task.adminLevel ?? 'X'}`,
          featureLabel: task.config?.featureLabel,
          featureGroupId: task.config?.featureGroupId,
          featureIndex: task.config?.featureIndex,
          originKey,
          originLabel,
          countryCode: task.countryCode,
          adminLevel: task.adminLevel,
          zoomLevel: zoomLevels[0] ?? 10,
          tileSize,
          preserveSharedBoundaries: simplificationMode === 'topojson',
          simplificationMode,
          quantize: simplify2Config?.quantize,
          algorithm: 'douglas-peucker',
          tolerance: simplify2Config?.tolerance,
          minimumArea: simplify2Config?.simplify,
          preserveTopology: true,
          maxVertices: undefined,
          coordinatePrecision: 6,
          enablePerFeatureSimplification: simplify2Config?.enablePerFeatureSimplification,
          retry: retry > 0 ? retry : undefined,
        },
      });
    });
    this.simplify2Tasks = tasks;
    if (tasks.length === 0) {
      console.warn(`[Session ${this.nodeId}] No simplify2 tasks to process`);
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
    const maxConcurrent = this.config.simplify2?.concurrentProcesses ?? this.options.maxConcurrentTasks;
    const r = await this.simplify2Adapter!.process(runnableTasks, reportProgress, {
      waitIfPaused: () => this.waitForStageResume('simplify2'),
      getSignal: () => this.getStageAbortSignal('simplify2'),
      maxConcurrent,
    });
    const skipped = await shapeDB.batchTasks
      .where('nodeId')
      .equals(this.nodeId)
      .and((task) => task.taskType === 'simplify2' && isSkippedMessage(task.message))
      .count();
    const completed = Math.min(total, baseCompleted + r.processed);
    const failed = Math.min(total - completed, baseFailed + r.failed);
    const done = Math.min(total, completed + failed + skipped);
    this.progressCallback?.({
      total,
      completed,
      failed,
      skipped,
      percentage: total > 0 ? (done / total) * 100 : 0,
      currentStage: 'simplify2',
      currentTask: 'Simplify2 completed',
    });
    console.log(
      `[Session ${this.nodeId}] Simplify2 stage completed: ${baseCompleted + r.processed}/${total} successful`,
    );
    if (isShapePreviewMetadataEnabled()) {
      const db = getEphemeralShapeDB();
      const statsByOrigin = new Map<string, GeometryStatsSummary>();
      for (const task of this.simplify2Tasks) {
        const originKey = this.getOriginKeyFromTask(task);
        if (!originKey) continue;
        const bufferId = `${this.nodeId}-simplify2-${task.index ?? 0}`;
        const buffer = await db.simplifiedBuffers.get(bufferId);
        if (!buffer) continue;
        const stats = await this.summarizeBufferStats(buffer.data);
        const existing = statsByOrigin.get(originKey) ?? { vertexCount: 0, polygonCount: 0 };
        statsByOrigin.set(originKey, this.accumulateStats(existing, stats));
      }
      await this.updateSourceMetadataStage('simplify2', statsByOrigin);
    }
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

  private buildStageTileKey(z: number, x: number, y: number): string {
    return `${String(this.nodeId)}-${z}-${x}-${y}`;
  }


  private pickFirstString(properties: Record<string, unknown>, keys: string[]): string | undefined {
    for (const key of keys) {
      const value = properties[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return undefined;
  }

  private pickAdminName(properties: Record<string, unknown>): string | undefined {
    return this.pickFirstString(properties, [
      'adminName',
      'admin_name',
      'ADMIN_NAME',
      'shapeName',
      'NAME_0',
      'NAME_1',
      'NAME_2',
      'NAME_3',
      'NAME_4',
      'NAME_5',
      'name',
    ]);
  }

  private pickCountryCode(properties: Record<string, unknown>): string | undefined {
    return this.pickFirstString(properties, ['ISO_A3', 'ISO3', 'ADM0_A3', 'countryCode', 'COUNTRY_CODE']);
  }

  private pickCountryName(properties: Record<string, unknown>): string | undefined {
    return this.pickFirstString(properties, ['COUNTRY_NAME', 'COUNTRY', 'NAME_0', 'countryName']);
  }

  private pickAdminCode(properties: Record<string, unknown>): string | undefined {
    return this.pickFirstString(properties, ['GID_0', 'GID_1', 'GID_2', 'GID_3', 'shapeID', 'adminCode', 'code']);
  }

  private pickAdminLevel(properties: Record<string, unknown>): number | undefined {
    const candidates = [
      properties.adminLevel,
      properties.admin_level,
      properties.ADM_LEVEL,
      properties.level,
    ];
    for (const value of candidates) {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return undefined;
  }

  private countVertices(coords: unknown): number {
    if (!Array.isArray(coords)) return 0;
    if (coords.length === 0) return 0;
    if (typeof coords[0] === 'number') return 1;
    return coords.reduce((sum, child) => sum + this.countVertices(child), 0);
  }

  private countVerticesFromGeometry(geometry?: Geometry | null): number {
    if (!geometry) return 0;
    if (geometry.type === 'GeometryCollection') {
      return geometry.geometries.reduce((sum, child) => sum + this.countVerticesFromGeometry(child), 0);
    }
    return this.countVertices(geometry.coordinates);
  }

  private countPolygons(geometry?: Geometry | null): number {
    if (!geometry) return 0;
    if (geometry.type === 'Polygon') return 1;
    if (geometry.type === 'MultiPolygon') return geometry.coordinates.length;
    return 0;
  }

  private extractGeometryStats(feature: Feature): {
    vertexCount: number;
    polygonCount: number;
    bbox?: [number, number, number, number];
    area: number;
  } {
    const geometry = feature.geometry ?? null;
    let bbox: [number, number, number, number] | undefined;
    try {
      const box = turfBbox(feature as unknown as Feature);
      if (box.every((value) => Number.isFinite(value))) {
        bbox = [box[0], box[1], box[2], box[3]];
      }
    } catch {
      bbox = undefined;
    }
    const vertexCount = this.countVerticesFromGeometry(geometry);
    const polygonCount = this.countPolygons(geometry);
    const area = geometry ? turfArea(feature as unknown as Feature) : 0;
    return {
      vertexCount,
      polygonCount,
      bbox,
      area,
    };
  }

  private buildOriginMetadata(output: DownloadStageOutput): OriginMetadata {
    const dataSource = output.dataSource ?? this.resolveDataSource();
    const countryCode = output.countryCode?.trim().toUpperCase();
    const adminLevel = output.adminLevel;
    const groupId = output.featureGroupId ?? output.featureLabel ?? output.inputBufferId;
    const levelLabel = adminLevel != null ? `ADM${adminLevel}` : undefined;
    const originLabel = output.featureLabel
      ?? output.featureGroupId
      ?? [output.countryName ?? countryCode ?? 'Unknown', levelLabel].filter(Boolean).join(' ');
    const originKeyParts = [
      dataSource ?? 'unknown',
      countryCode ?? 'unknown',
      levelLabel ?? 'ADM?',
      groupId,
    ];
    return {
      originKey: originKeyParts.join('|'),
      originLabel,
      inputBufferId: output.inputBufferId,
      dataSource,
      countryName: output.countryName,
      countryCode,
      adminLevel,
      featureGroupId: output.featureGroupId,
      featureLabel: output.featureLabel,
    };
  }

  private indexOriginMetadata(outputs: DownloadStageOutput[]): OriginMetadata[] {
    const entries = outputs.map((output) => this.buildOriginMetadata(output));
    this.originMetadataByKey = new Map(entries.map((entry) => [entry.originKey, entry]));
    this.originMetadataByBuffer = new Map(entries.map((entry) => [entry.inputBufferId, entry]));
    return entries;
  }

  private getOriginKeyFromTask(task: { config?: { originKey?: string }; metadata?: Record<string, unknown> }): string | undefined {
    if (task.config?.originKey) return task.config.originKey;
    const metadata = task.metadata ?? {};
    return typeof metadata.originKey === 'string' ? metadata.originKey : undefined;
  }

  private accumulateStats(target: GeometryStatsSummary, next: GeometryStatsSummary): GeometryStatsSummary {
    const vertexCount = target.vertexCount + next.vertexCount;
    const polygonCount = target.polygonCount + next.polygonCount;
    let bbox = target.bbox;
    if (next.bbox) {
      if (!bbox) {
        bbox = next.bbox;
      } else {
        bbox = [
          Math.min(bbox[0], next.bbox[0]),
          Math.min(bbox[1], next.bbox[1]),
          Math.max(bbox[2], next.bbox[2]),
          Math.max(bbox[3], next.bbox[3]),
        ];
      }
    }
    return { vertexCount, polygonCount, bbox };
  }

  private async summarizeBufferStats(buffer: ArrayBuffer): Promise<GeometryStatsSummary> {
    const collection = await this.decodeFeatureCollection(buffer);
    if (!collection || collection.features.length === 0) {
      return { vertexCount: 0, polygonCount: 0 };
    }
    let summary: GeometryStatsSummary = { vertexCount: 0, polygonCount: 0 };
    for (const feature of collection.features) {
      if (!feature) continue;
      const stats = this.extractGeometryStats(feature);
      summary = this.accumulateStats(summary, {
        vertexCount: stats.vertexCount,
        polygonCount: stats.polygonCount,
        bbox: stats.bbox,
      });
    }
    return summary;
  }

  private async updateSourceMetadataBase(entries: OriginMetadata[]): Promise<void> {
    const db = await getShapeTileMetadataDB();
    const nodeKey = String(this.nodeId);
    const existing = await db.sourceMetadata.where('nodeId').equals(nodeKey).toArray();
    const existingByKey = new Map(existing.map((row) => [row.originKey, row]));
    const nextKeys = new Set(entries.map((entry) => entry.originKey));
    const staleIds = existing.filter((row) => !nextKeys.has(row.originKey)).map((row) => row.id);
    if (staleIds.length > 0) {
      await db.sourceMetadata.bulkDelete(staleIds);
    }
    const now = Date.now();
    const rows: ShapeSourceMetadataRow[] = entries.map((entry) => {
      const prior = existingByKey.get(entry.originKey);
      return {
        id: prior?.id ?? `${nodeKey}-${entry.originKey}`,
        nodeId: nodeKey,
        originKey: entry.originKey,
        originLabel: entry.originLabel,
        dataSource: entry.dataSource,
        countryName: entry.countryName,
        countryCode: entry.countryCode,
        adminLevel: entry.adminLevel,
        featureGroupId: entry.featureGroupId,
        featureLabel: entry.featureLabel,
        createdAt: prior?.createdAt ?? now,
        updatedAt: now,
        rawVertexCount: prior?.rawVertexCount,
        rawPolygonCount: prior?.rawPolygonCount,
        simplify1VertexCount: prior?.simplify1VertexCount,
        simplify1PolygonCount: prior?.simplify1PolygonCount,
        simplify2VertexCount: prior?.simplify2VertexCount,
        simplify2PolygonCount: prior?.simplify2PolygonCount,
        vectorTileVertexCount: prior?.vectorTileVertexCount,
        vectorTilePolygonCount: prior?.vectorTilePolygonCount,
        bbox: prior?.bbox,
      };
    });
    if (rows.length > 0) {
      await db.sourceMetadata.bulkPut(rows);
    }
  }

  private async updateSourceMetadataStage(
    stage: 'raw' | 'simplify1' | 'simplify2' | 'vectorTile',
    statsByOrigin: Map<string, GeometryStatsSummary>,
  ): Promise<void> {
    if (statsByOrigin.size === 0) return;
    const db = await getShapeTileMetadataDB();
    const nodeKey = String(this.nodeId);
    const existing = await db.sourceMetadata.where('nodeId').equals(nodeKey).toArray();
    const existingByKey = new Map(existing.map((row) => [row.originKey, row]));
    const now = Date.now();
    const rows: ShapeSourceMetadataRow[] = [];
    for (const [originKey, stats] of statsByOrigin.entries()) {
      const prior = existingByKey.get(originKey);
      const base = this.originMetadataByKey.get(originKey);
      if (!prior && !base) continue;
      const bbox = (stage === 'raw' || stage === 'simplify2')
        ? (stats.bbox ?? prior?.bbox)
        : prior?.bbox;
      rows.push({
        id: prior?.id ?? `${nodeKey}-${originKey}`,
        nodeId: nodeKey,
        originKey,
        originLabel: prior?.originLabel ?? base?.originLabel ?? originKey,
        dataSource: prior?.dataSource ?? base?.dataSource,
        countryName: prior?.countryName ?? base?.countryName,
        countryCode: prior?.countryCode ?? base?.countryCode,
        adminLevel: prior?.adminLevel ?? base?.adminLevel,
        featureGroupId: prior?.featureGroupId ?? base?.featureGroupId,
        featureLabel: prior?.featureLabel ?? base?.featureLabel,
        createdAt: prior?.createdAt ?? now,
        updatedAt: now,
        rawVertexCount: stage === 'raw' ? stats.vertexCount : prior?.rawVertexCount,
        rawPolygonCount: stage === 'raw' ? stats.polygonCount : prior?.rawPolygonCount,
        simplify1VertexCount: stage === 'simplify1' ? stats.vertexCount : prior?.simplify1VertexCount,
        simplify1PolygonCount: stage === 'simplify1' ? stats.polygonCount : prior?.simplify1PolygonCount,
        simplify2VertexCount: stage === 'simplify2' ? stats.vertexCount : prior?.simplify2VertexCount,
        simplify2PolygonCount: stage === 'simplify2' ? stats.polygonCount : prior?.simplify2PolygonCount,
        vectorTileVertexCount: stage === 'vectorTile' ? stats.vertexCount : prior?.vectorTileVertexCount,
        vectorTilePolygonCount: stage === 'vectorTile' ? stats.polygonCount : prior?.vectorTilePolygonCount,
        bbox,
      });
    }
    if (rows.length > 0) {
      await db.sourceMetadata.bulkPut(rows);
    }
  }

  private async summarizeVectorTilesByOrigin(): Promise<Map<string, GeometryStatsSummary>> {
    const statsByOrigin = new Map<string, GeometryStatsSummary>();
    const tilesDb = await TilesDB.getSingleton();
    const rows = await tilesDb.tiles.where('nodeId').equals(String(this.nodeId)).toArray();
    for (const row of rows) {
      const tile = new VectorTile(new Pbf(new Uint8Array(row.data)));
      for (const layerName of Object.keys(tile.layers)) {
        const layer = tile.layers[layerName];
        if (!layer) continue;
        for (let index = 0; index < layer.length; index += 1) {
          const feature = layer.feature(index);
          const geojson = feature.toGeoJSON(row.x, row.y, row.z) as Feature;
          const properties = (geojson.properties ?? {}) as Record<string, unknown>;
          const originKey = typeof properties[HDB_ORIGIN_KEY] === 'string'
            ? String(properties[HDB_ORIGIN_KEY])
            : undefined;
          if (!originKey) continue;
          const stats = this.extractGeometryStats(geojson);
          const existing = statsByOrigin.get(originKey) ?? { vertexCount: 0, polygonCount: 0 };
          statsByOrigin.set(originKey, this.accumulateStats(existing, {
            vertexCount: stats.vertexCount,
            polygonCount: stats.polygonCount,
          }));
        }
      }
    }
    return statsByOrigin;
  }

  private buildFeatureId(base: string, index: number, countryCode?: string, adminLevel?: number, adminCode?: string): string {
    const baseId = base.trim().length > 0 ? base.trim() : (adminCode ?? `feature-${index}`);
    const prefixParts = [
      countryCode,
      adminLevel != null ? `ADM${adminLevel}` : undefined,
      adminCode,
    ].filter(Boolean);
    const prefix = prefixParts.join('-');
    const composed = prefix ? `${prefix}:${baseId}` : baseId;
    return `${composed}:${index}`;
  }

  private async ensureTileFeatureIndex(): Promise<Array<{ key: string; z: number; x: number; y: number }>> {
    const tileDb = await getShapeTileMetadataDB();
    const zoomLevels = this.resolveZoomLevels();
    if (zoomLevels.length === 0) {
      this.lastTileIndexStats = {
        totalTiles: 0,
        acceptedTiles: 0,
        skippedSerialization: 0,
        skippedSize: 0,
      };
      return [];
    }
    const db = getEphemeralShapeDB();
    const tilesByKey = new Map<string, { key: string; z: number; x: number; y: number; features: Feature[] }>();
    const metadataRecords: Array<{
      id: string;
      nodeId: string;
      featureId: string;
      countryName?: string;
      countryCode?: string;
      adminName?: string;
      adminLevel?: number;
      adminCode?: string;
      dataSource?: string;
      createdAt: number;
      vertexCount: number;
      polygonCount: number;
      bbox?: [number, number, number, number];
      area: number;
    }> = [];
    const createdAt = Date.now();

    for (const task of this.simplify2Tasks) {
      const inputBufferId = task.inputBufferId ?? `${this.nodeId}-simplify2-${task.index ?? 0}`;
      const buffer = await db.simplifiedBuffers.get(inputBufferId);
      if (!buffer) continue;
      const collection = await this.decodeFeatureCollection(buffer.data);
      if (!collection) continue;
      for (let index = 0; index < collection.features.length; index++) {
        const feature = collection.features[index];
        if (!feature) continue;
        const properties = (feature.properties ??= {});
        const stats = this.extractGeometryStats(feature);
        const countryCode = task.countryCode ?? this.pickCountryCode(properties);
        const adminLevel = task.adminLevel ?? this.pickAdminLevel(properties);
        const adminCode = this.pickAdminCode(properties);
        const precomputedId = this.pickFirstString(properties, ['__hdbFeatureId', 'hdbFeatureId']);
        const baseId = String(properties.id ?? feature.id ?? `feature-${index}`);
        const featureId = precomputedId ?? this.buildFeatureId(baseId, index, countryCode, adminLevel, adminCode);
        properties.id = featureId;
        metadataRecords.push({
          id: `${String(this.nodeId)}-${featureId}`,
          nodeId: String(this.nodeId),
          featureId,
          countryName: this.pickCountryName(properties),
          countryCode,
          adminName: this.pickAdminName(properties),
          adminLevel,
          adminCode,
          dataSource: this.resolveDataSource(),
          createdAt,
          vertexCount: stats.vertexCount,
          polygonCount: stats.polygonCount,
          bbox: stats.bbox,
          area: stats.area,
        });
        if (!stats.bbox) continue;
        const tiles = this.buildTileCoordinates(stats.bbox, zoomLevels);
        for (const tile of tiles) {
          const key = this.buildStageTileKey(tile.z, tile.x, tile.y);
          const existingEntry = tilesByKey.get(key);
          if (existingEntry) {
            existingEntry.features.push(feature);
          } else {
            tilesByKey.set(key, { key, z: tile.z, x: tile.x, y: tile.y, features: [feature] });
          }
        }
      }
    }

    if (metadataRecords.length > 0) {
      await tileDb.featureMetadata.bulkPut(metadataRecords);
    }

    const tileRows = Array.from(tilesByKey.values());
    const acceptedRows: Array<{ key: string; z: number; x: number; y: number }> = tileRows.map((row) => ({
      key: row.key,
      z: row.z,
      x: row.x,
      y: row.y,
    }));
    this.lastTileIndexStats = {
      totalTiles: tileRows.length,
      acceptedTiles: acceptedRows.length,
      skippedSerialization: 0,
      skippedSize: 0,
    };
    return acceptedRows;
  }

  private buildVectorTileTasks(
    tileRows: Array<{ key: string; z: number; x: number; y: number }>,
  ): VectorTileTask[] {
    const tileSize = this.config.vectorTiles?.tileSize ?? this.config.tileSize ?? 256;
    const buffer = this.config.vectorTiles?.bufferSize ?? 256;
    const minZoom = this.config.vectorTiles?.minZoom ?? 0;
    const maxZoom = this.config.vectorTiles?.maxZoom ?? 10;
    const metadataEnabled = false;
    return tileRows.map((tile, index) => ({
      taskId: `${this.nodeId}-vectortile-${index}`,
      nodeId: this.nodeId,
      taskType: 'vectortile',
      stage: BatchTaskStage.WAIT,
      type: 'vectortile',
      status: 'waiting',
      index,
      progress: 0,
      zoomLevel: tile.z,
      config: {
        inputBufferId: tile.key,
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
      },
    }));
  }

  private async persistPlaceholderMetadata(replace: boolean): Promise<number> {
    if (!isShapePreviewMetadataEnabled()) return 0;
    const nodeKey = String(this.nodeId);
    const db = await getShapeTileMetadataDB();
    if (replace) {
      await db.featureMetadata.where('nodeId').equals(nodeKey).delete();
    }
    const existing = replace
      ? new Set<string>()
      : new Set(
        (await db.featureMetadata.where('nodeId').equals(nodeKey).toArray())
          .map((row) => row.featureId),
      );
    const createdAt = Date.now();
    const dataSourceFallback = this.resolveDataSource();
    const rows = [];
    for (const payload of this.downloadTaskPayloads) {
      const dataSource = payload.dataSource ?? dataSourceFallback;
      const countryCode = (payload.countryCode ?? 'UNK').trim().toUpperCase();
      const adminLevel = payload.adminLevel;
      const featureKey = `${dataSource ?? 'unknown'}:${countryCode}:${adminLevel ?? 'NA'}`;
      if (existing.has(featureKey)) continue;
      existing.add(featureKey);
      rows.push({
        id: `${nodeKey}-${featureKey}`,
        nodeId: nodeKey,
        featureId: featureKey,
        countryName: payload.countryName,
        countryCode,
        adminLevel,
        dataSource,
        createdAt,
        vertexCount: 0,
        polygonCount: 0,
        area: 0,
      });
    }
    if (rows.length > 0) {
      await db.featureMetadata.bulkPut(rows);
    }
    return rows.length;
  }

  /**
   * Process vector tile generation stage
   */
  private async processVectorTileStage(): Promise<void> {
    this.currentStage = 'vectortile';
    console.log(`[Session ${this.nodeId}] Processing vector tile stage`);

    const tileRows = await this.ensureTileFeatureIndex();
    if (tileRows.length === 0) {
      console.warn(`[Session ${this.nodeId}] No vector tile inputs to process`);
      await this.persistPlaceholderMetadata(true);
      const stats = this.lastTileIndexStats;
      const detailParts = [
        stats ? `tiles=${stats.totalTiles}` : undefined,
        stats ? `accepted=${stats.acceptedTiles}` : undefined,
        stats && stats.skippedSerialization > 0 ? `serializeFailed=${stats.skippedSerialization}` : undefined,
        stats && stats.skippedSize > 0 ? `tooLarge=${stats.skippedSize}` : undefined,
      ].filter(Boolean);
      const detailSuffix = detailParts.length > 0 ? ` (${detailParts.join(', ')})` : '';
      console.warn(`[Session ${this.nodeId}] Vector tile stage skipped${detailSuffix}`);
      this.progressCallback?.({
        total: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 100,
        currentStage: 'vectortile',
        currentTask: 'No vector tile inputs',
      });
      return;
    }
    const tasks = this.buildVectorTileTasks(tileRows);
    await this.applyVectorTileRetryOverrides(tasks);
    if (tasks.length === 0) {
      console.warn(`[Session ${this.nodeId}] No vector tile tasks to process`);
      return;
    }

    await this.registerTasks('vectortile', tasks);
    const { runnableTasks, completedCount, failedCount, total } = await this.resolveStageTasks('vectortile', tasks);
    const baseCompleted = Math.min(completedCount, total);
    const baseFailed = Math.min(failedCount, total - baseCompleted);
    const baseDone = Math.min(total, baseCompleted + baseFailed);
    this.progressCallback?.({
      total,
      completed: baseCompleted,
      failed: baseFailed,
      skipped: 0,
      percentage: total > 0 ? (baseDone / total) * 100 : 0,
      currentStage: 'vectortile',
      currentTask: 'Vector tile tasks queued',
    });
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
    const baseConcurrent = this.config.vectorTiles?.concurrentProcesses ?? this.options.maxConcurrentTasks;
    const maxConcurrent = this.simplify2RetryOverride > 0
      ? 1
      : (baseConcurrent ?? 1);
    const r = await this.vectorTileAdapter!.process(runnableTasks, reportProgress, {
      waitIfPaused: () => this.waitForStageResume('vectortile'),
      getSignal: () => this.getStageAbortSignal('vectortile'),
      maxConcurrent,
      requestPause: (message) => this.requestPause('vectortile', message),
    });
    await this.persistPlaceholderMetadata(false);
    await this.syncVectorTilesToShapeDb();
    if (isShapePreviewMetadataEnabled()) {
      const statsByOrigin = await this.summarizeVectorTilesByOrigin();
      await this.updateSourceMetadataStage('vectorTile', statsByOrigin);
    }
    this.vectorTileAdapter?.clearFeatureCache?.(String(this.nodeId));
    console.log(
      `[Session ${this.nodeId}] Vector tile stage completed: ${baseCompleted + r.processed}/${total} successful`,
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
    const now = Date.now();
    if (stage === 'vectortile') {
      const existing = await shapeDB.batchTasks
        .where('nodeId')
        .equals(this.nodeId)
        .and((task) => task.taskType === stage)
        .toArray();
      const existingById = new Map(existing.map((task) => [task.taskId, task]));
      const newTasks = [];
      for (const [index, task] of tasks.entries()) {
        const existingTask = existingById.get(task.taskId);
        if (!existingTask) {
          newTasks.push({
            taskId: task.taskId,
            nodeId: this.nodeId,
            taskType: stage,
            status: 'waiting' as const,
            index: task.index ?? index,
            progress: 0,
            inputData: typeof task.config === 'object' && task.config ? (task.config as Record<string, unknown>) : undefined,
            createdAt: now,
            updatedAt: now,
          });
          continue;
        }
        if (existingTask.status !== 'regression') {
          continue;
        }
        const currentRetry = this.getRetryValue(existingTask);
        const nextRetry = currentRetry + 1;
        const nextInputData = {
          ...(existingTask.inputData ?? {}),
          ...(typeof task.config === 'object' && task.config ? (task.config as Record<string, unknown>) : {}),
          retry: nextRetry,
        };
        await shapeDB.updateBatchTask(task.taskId, { inputData: nextInputData });
      }
      if (newTasks.length > 0) {
        const chunkSize = 50;
        for (let offset = 0; offset < newTasks.length; offset += chunkSize) {
          await shapeDB.batchTasks.bulkPut(newTasks.slice(offset, offset + chunkSize));
        }
      }
      return;
    }
    const existingIds = existingTaskIds ?? new Set(
      (await shapeDB.batchTasks
        .where('nodeId')
        .equals(this.nodeId)
        .and((task) => task.taskType === stage)
        .toArray())
        .map((task) => task.taskId),
    );
    const newTasks = tasks
      .filter((task) => !existingIds.has(task.taskId))
      .map((task, index) => ({
        taskId: task.taskId,
        nodeId: this.nodeId,
        taskType: stage,
        status: 'waiting' as const,
        index: task.index ?? index,
        progress: 0,
        inputData: typeof task.config === 'object' && task.config ? (task.config as Record<string, unknown>) : undefined,
        createdAt: now,
        updatedAt: now,
      }));
    if (newTasks.length > 0) {
      const chunkSize = 50;
      for (let offset = 0; offset < newTasks.length; offset += chunkSize) {
        await shapeDB.batchTasks.bulkPut(newTasks.slice(offset, offset + chunkSize));
      }
    }
  }

  private async resolveStageTasks<T extends { taskId: string }>(
    stage: ProcessingStage,
    tasks: T[],
  ): Promise<{ runnableTasks: T[]; completedCount: number; failedCount: number; total: number }> {
    const existing = await shapeDB.batchTasks
      .where('nodeId')
      .equals(this.nodeId)
      .and((task) => task.taskType === stage)
      .toArray();
    const statusById = new Map(existing.map((task) => [task.taskId, task.status]));
    const runnableTasks = tasks.filter((task) => {
      const status = statusById.get(task.taskId);
      return status === 'waiting' || status === 'regression';
    });
    const completedCount = existing.filter((task) => task.status === 'completed').length;
    const failedCount = existing.filter((task) => task.status === 'failed').length;
    return { runnableTasks, completedCount, failedCount, total: tasks.length };
  }

  private getRetryValue(task: BatchTaskRecord): number {
    const input = task.inputData ?? {};
    const retry = (input as { retry?: number }).retry;
    return typeof retry === 'number' && Number.isFinite(retry) ? retry : 0;
  }

  private async getVectorTileRegressionRetry(): Promise<number | null> {
    const tasks = await shapeDB.batchTasks
      .where('nodeId')
      .equals(this.nodeId)
      .and((task) => task.taskType === 'vectortile' && task.status === 'regression')
      .toArray();
    if (tasks.length === 0) return null;
    const retryable = tasks
      .map((task) => this.getRetryValue(task))
      .filter((retry) => retry < 2);
    if (retryable.length === 0) return null;
    return Math.max(...retryable);
  }

  private async prepareSimplify2Retry(retry: number): Promise<void> {
    this.simplify2RetryOverride = retry;
    const simplify2Tasks = await shapeDB.batchTasks
      .where('nodeId')
      .equals(this.nodeId)
      .and((task) => task.taskType === 'simplify2')
      .toArray();
    for (const task of simplify2Tasks) {
      const inputData = { ...(task.inputData ?? {}), retry };
      await shapeDB.updateBatchTask(task.taskId, {
        status: 'waiting',
        progress: 0,
        startedAt: undefined,
        completedAt: undefined,
        errorMessage: undefined,
        inputData,
      });
    }
    await this.resetVectorTileTasksForRetry();
    this.vectorTileAdapter?.clearFeatureCache?.(String(this.nodeId));
  }

  private async resetVectorTileTasksForRetry(): Promise<void> {
    const vectorTasks = await shapeDB.batchTasks
      .where('nodeId')
      .equals(this.nodeId)
      .and((task) => task.taskType === 'vectortile')
      .toArray();
    for (const task of vectorTasks) {
      const needsReset = task.status === 'completed' || task.status === 'failed';
      if (!needsReset) {
        await shapeDB.updateBatchTask(task.taskId, {
          progress: 0,
          startedAt: undefined,
          completedAt: undefined,
          errorMessage: undefined,
        });
        continue;
      }
      await shapeDB.updateBatchTask(task.taskId, {
        status: 'waiting',
        progress: 0,
        startedAt: undefined,
        completedAt: undefined,
        errorMessage: undefined,
      });
    }
  }

  private async applyVectorTileRetryOverrides(tasks: VectorTileTask[]): Promise<void> {
    const existing = await shapeDB.batchTasks
      .where('nodeId')
      .equals(this.nodeId)
      .and((task) => task.taskType === 'vectortile')
      .toArray();
    if (existing.length === 0) return;
    const retryById = new Map(existing.map((task) => [task.taskId, this.getRetryValue(task)]));
    tasks.forEach((task) => {
      const retry = retryById.get(task.taskId);
      if (!retry) return;
      task.config = { ...(task.config ?? {}), retry };
    });
  }

  private async assignDownloadTaskIndices(tasks: DownloadTask[]): Promise<Set<string>> {
    const existing = await shapeDB.batchTasks
      .where('nodeId')
      .equals(this.nodeId)
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
    nodeId: string;
    stage: ProcessingStage;
    isPaused: boolean;
    isAborted: boolean;
    hasWorkerPool: boolean;
  } {
    return {
      nodeId: String(this.nodeId),
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
