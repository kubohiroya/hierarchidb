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
import type { Extract1Task, Extract2Task, VectorTileTask } from '../../common/types/index.js';
import type { Extract1StageAdapter } from './adapters/Extract1StageAdapter.js';
import type { Extract2StageAdapter } from './adapters/Extract2StageAdapter.js';
import type { VectorTileStageAdapter } from './adapters/VectorTileStageAdapter.js';
import { ShapeWorkerExtract1Adapter, ShapeWorkerExtract2Adapter } from './adapters/ShapeWorkerExtractAdapters.js';
import { RuntimeWorkerVectorTileAdapter } from './adapters/RuntimeWorkerVectorTileAdapter.js';
import type { BatchProcessConfig } from './types.js';
import type { DataSourceName, DownloadTaskPayload, ProgressInfo, ProcessingStage } from '../../common/types/index.js';
import { BatchTaskStage } from '../../common/types/index.js';
import { isShapePreviewMetadataEnabled } from '../../common/config/previewFlags.js';
import type {
  ShapeExtract1TaskInputData,
  ShapeExtract2TaskInputData,
  ShapeFeatureMetadataRow,
  ShapeSourceMetadataRow,
  ShapeVectorTileTaskInputData,
} from '@hierarchidb/plugin-service-api';
import { createShapeBatchApiClient } from './ShapeBatchApiClient.js';
import { SessionTaskRegistry } from './SessionTaskRegistry.js';
import { SessionArtifactStore } from './SessionArtifactStore.js';
import type { DownloadStageOutput } from './strategies/DownloadStageStrategy.js';
import { resolveDownloadStageStrategy } from './strategies/resolveDownloadStageStrategy.js';
import { geojson as geojsonApi } from 'flatgeobuf';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { bbox as turfBbox, area as turfArea } from '@turf/turf';
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
  dataSource?: DataSourceName;
  sourceUrl?: string;
  countryName?: string;
  countryCode?: string;
  continent?: string;
  adminLevel?: number;
  featureGroupId?: string;
  featureLabel?: string;
  featureIndex?: number;
  featureCount?: number;
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
  private extract1Adapter?: Extract1StageAdapter;
  private extract2Adapter?: Extract2StageAdapter;
  private vectorTileAdapter?: VectorTileStageAdapter;
  private extract1Tasks: Extract1Task[] = [];
  private extract2Tasks: Extract2Task[] = [];
  private extract2RetryOverride = 0;
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
  private readonly taskRegistry: SessionTaskRegistry;
  private readonly artifactStore: SessionArtifactStore;

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
    const { query, mutation } = createShapeBatchApiClient();
    this.taskRegistry = new SessionTaskRegistry(nodeId, query, mutation);
    this.artifactStore = new SessionArtifactStore(nodeId, query, mutation);
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

  private resolveDataSource(): DataSourceName {
    const dataSource = this.config.dataSource ?? this.downloadTaskPayloads[0]?.dataSource;
    if (!dataSource) {
      throw new Error('Data source is required for batch processing');
    }
    return dataSource as DataSourceName;
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

  private async syncVectorTilesToShapeStore(): Promise<void> {
    await this.artifactStore.syncVectorTilesToShapeStore();
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
    stage: 'extract1' | 'extract2',
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

  private resolveTaskIdDetails(
    task: {
      countryCode?: string;
      adminLevel?: number;
    },
    input?: {
      featureLabel?: string;
      featureGroupId?: string;
    },
  ): {
    countryCode?: string;
    adminLevel?: number;
    featureLabel?: string;
    featureGroupId?: string;
  } {
    return {
      countryCode: task.countryCode,
      adminLevel: task.adminLevel,
      featureLabel: input?.featureLabel,
      featureGroupId: input?.featureGroupId,
    };
  }

  private async expandOutputsForFeatureGroups(outputs: DownloadStageOutput[]): Promise<DownloadStageOutput[]> {
    const expanded: DownloadStageOutput[] = [];
    const newBuffers: Array<{
      id: string;
      nodeId: NodeId;
      data: ArrayBuffer;
      featureCount: number;
      bbox: [number, number, number, number];
      downloadTime: number;
      size: number;
      timestamp: number;
    }> = [];
    for (const output of outputs) {
      const raw = await this.artifactStore.getRawBuffer(output.inputBufferId);
      if (!raw) {
        expanded.push(output);
        continue;
      }
      const collection = await this.decodeFeatureCollection(raw.data);
      if (!collection || collection.features.length === 0) {
        expanded.push(output);
        continue;
      }
      const resolvedContinent = output.continent
        ?? this.resolveContinentFromFeature(collection.features[0]);
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
        newBuffers.push({
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
          continent: resolvedContinent,
          inputBufferId: bufferId,
          featureGroupId,
          featureLabel,
          featureIndex: index,
          featureCount: collection.features.length,
        });
      }
    }
    if (newBuffers.length > 0) {
      await this.artifactStore.putRawBuffers(newBuffers);
    }
    return expanded;
  }

  private resolveContinentFromFeature(feature?: Feature | null): string | undefined {
    if (!feature || !feature.properties) return undefined;
    const props = feature.properties as Record<string, unknown>;
    const candidates = [props.continent, props.Continent, props.CONTINENT];
    for (const value of candidates) {
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
    return undefined;
  }

  /**
   * Initialize the session by creating a new WorkerPool
   */
  async initialize(): Promise<void> {
    if (this.workerPool) {
      throw new Error(`Session ${this.nodeId} already initialized`);
    }

    // Use shape-stage workers for download/extract and runtime-worker for vector tiles.
    this.extract1Adapter = new ShapeWorkerExtract1Adapter();
    this.extract2Adapter = new ShapeWorkerExtract2Adapter();
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
        await this.processExtract1Stage();
      }
      await waitForResumeIfPaused();

      if (!this.isAborted && !this.isPaused) {
        await this.processExtract2Stage();
      }
      await waitForResumeIfPaused();

      if (!this.isAborted && !this.isPaused) {
        await this.processVectorTileStage();
      }
      await waitForResumeIfPaused();

      let regressionRounds = 0;
      while (!this.isAborted && !this.isPaused) {
        const retry = await this.taskRegistry.getVectorTileRegressionRetry();
        if (retry == null) break;
        regressionRounds += 1;
        if (regressionRounds > 2) {
          console.warn(`[Session ${this.nodeId}] Regression retry limit reached; skipping further retries.`);
          break;
        }
        console.warn(
          `[Session ${this.nodeId}] Vector tile regression detected (retry=${retry}); restarting extract2.`,
        );
        await this.prepareExtract2Retry(retry);
        await this.processExtract2Stage();
        await waitForResumeIfPaused();
        if (this.isAborted || this.isPaused) break;
        await this.processVectorTileStage();
        await waitForResumeIfPaused();
      }
      this.extract2RetryOverride = 0;

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
    const { tasks, inputsByTaskId } = await strategy.buildDownloadTasks({
      nodeId: this.nodeId,
      downloadTaskPayloads: this.downloadTaskPayloads,
      config: this.config,
      options: {
        timeoutMs: this.options.timeoutMs,
        retryAttempts: this.options.retryAttempts,
        retryDelay: this.options.retryDelay,
      },
    });
    const existingTaskIds = await this.taskRegistry.assignDownloadTaskIndices(tasks);
    await this.taskRegistry.registerTasks('download', tasks, existingTaskIds, inputsByTaskId);
    await this.taskRegistry.markDownloadTasksCompletedWhenBuffersExist(tasks);
    const { runnableTasks, completedCount, failedCount, total } =
      await this.taskRegistry.resolveStageTasks('download', tasks);
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
        inputsByTaskId,
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
      downloadInputsById: inputsByTaskId,
    });
    const expandedOutputs = await this.expandOutputsForFeatureGroups(postprocess.outputs);
    if (isShapePreviewMetadataEnabled()) {
      const originEntries = this.indexOriginMetadata(expandedOutputs);
      await this.updateSourceMetadataBase(originEntries);
      const rawStatsByOrigin = new Map<string, GeometryStatsSummary>();
      for (const entry of originEntries) {
        const raw = await this.artifactStore.getRawBuffer(entry.inputBufferId);
        if (!raw) continue;
        const stats = await this.summarizeBufferStats(raw.data);
        const existing = rawStatsByOrigin.get(entry.originKey) ?? { vertexCount: 0, polygonCount: 0 };
        rawStatsByOrigin.set(entry.originKey, this.accumulateStats(existing, stats));
      }
      await this.updateSourceMetadataStage('raw', rawStatsByOrigin);
    } else {
      this.indexOriginMetadata(expandedOutputs);
    }
    this.extract1Tasks = this.buildExtract1Tasks(expandedOutputs);
  }

  private buildExtract1Tasks(outputs: DownloadStageOutput[]): Extract1Task[] {
    return outputs.map((output, index) => {
      const featureLabel = output.featureLabel ?? output.featureGroupId;
      const taskId = this.buildProcessingTaskId('extract1', {
        countryCode: output.countryCode,
        adminLevel: output.adminLevel,
        featureLabel,
        featureGroupId: output.featureGroupId,
      });
      return {
        taskId,
        nodeId: this.nodeId,
        taskType: 'extract1',
        stage: BatchTaskStage.WAIT,
        type: 'extract1',
        status: 'waiting',
        index,
        progress: 0,
        inputBufferId: output.inputBufferId,
        countryCode: output.countryCode,
        adminLevel: output.adminLevel,
      };
    });
  }

  /**
   * Process extract1 stage
   */
  private async processExtract1Stage(): Promise<void> {
    this.currentStage = 'extract1';
    console.log(`[Session ${this.nodeId}] Processing extract1 stage`);

    const tasks = this.extract1Tasks;
    if (tasks.length === 0) {
      console.warn(`[Session ${this.nodeId}] No extract1 tasks to process`);
      return;
    }

    const inputsByTaskId = new Map<string, ShapeExtract1TaskInputData>();
    for (const task of tasks) {
      const bufferId = task.inputBufferId ?? '';
      const origin = this.originMetadataByBuffer.get(bufferId);
      const featureLabel = origin?.featureLabel ?? origin?.featureGroupId;
      const featureId = featureLabel
        ?? origin?.featureGroupId
        ?? `${task.countryCode ?? 'UNK'}:ADM${task.adminLevel ?? 'X'}`;
      inputsByTaskId.set(task.taskId, {
        inputBufferId: task.inputBufferId,
        sourceUrl: origin?.sourceUrl,
        featureId,
        featureLabel,
        featureGroupId: origin?.featureGroupId,
        featureIndex: origin?.featureIndex,
        originKey: origin?.originKey,
        originLabel: origin?.originLabel,
        adminCode: origin?.featureGroupId,
        dataSource: origin?.dataSource,
        countryCode: origin?.countryCode ?? task.countryCode,
        adminLevel: origin?.adminLevel ?? task.adminLevel,
        continent: origin?.continent,
        countryName: origin?.countryName,
      });
    }
    await this.taskRegistry.registerTasks('extract1', tasks, undefined, inputsByTaskId);
    const { runnableTasks, completedCount, failedCount, total } =
      await this.taskRegistry.resolveStageTasks('extract1', tasks);
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
        currentStage: 'extract1',
        currentTask: 'Extract1 already completed',
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
        currentStage: 'extract1',
      });
    };
    const maxConcurrent = this.config.extract1?.concurrentProcesses ?? this.options.maxConcurrentTasks;
    await this.extract1Adapter!.process(runnableTasks, reportProgress, {
      waitIfPaused: () => this.waitForStageResume('extract1'),
      getSignal: () => this.getStageAbortSignal('extract1'),
      maxConcurrent,
    });
    const stageRecords = await this.taskRegistry.listStageRecords('extract1');
    const stageTotal = stageRecords.length;
    const stageSkipped = stageRecords.filter((task) => this.isSkippedMessage(task.message)).length;
    const stageFailed = stageRecords.filter((task) => task.status === 'failed' || task.status === 'regression').length;
    const stageCompleted = Math.max(
      0,
      stageRecords.filter((task) => task.status === 'completed').length - stageSkipped,
    );
    console.log(`[Session ${this.nodeId}] Extract1 stage summary`, {
      total: stageTotal,
      completed: stageCompleted,
      skipped: stageSkipped,
      failed: stageFailed,
    });
    if (isShapePreviewMetadataEnabled()) {
      const statsByOrigin = new Map<string, GeometryStatsSummary>();
      for (const task of this.extract1Tasks) {
        const originKey = this.getOriginKeyFromInput(inputsByTaskId.get(task.taskId));
        if (!originKey) continue;
        const bufferId = `${this.nodeId}-extract1-${task.index ?? 0}`;
        const buffer = await this.artifactStore.getExtractedBuffer(bufferId);
        if (!buffer) continue;
        const stats = await this.summarizeBufferStats(buffer.data);
        const existing = statsByOrigin.get(originKey) ?? { vertexCount: 0, polygonCount: 0 };
        statsByOrigin.set(originKey, this.accumulateStats(existing, stats));
      }
      await this.updateSourceMetadataStage('extract1', statsByOrigin);
    }
  }

  private buildExtract2TasksFromExtract1(
    extract1InputsByTaskId: Map<string, ShapeExtract1TaskInputData>,
  ): { tasks: Extract2Task[]; inputsByTaskId: Map<string, ShapeExtract2TaskInputData> } {
    const inputsByTaskId = new Map<string, ShapeExtract2TaskInputData>();
    const tasks: Extract2Task[] = this.extract1Tasks.map((task, index) => {
      const input = extract1InputsByTaskId.get(task.taskId);
      const featureId = input?.featureId ?? `${task.countryCode ?? 'UNK'}:ADM${task.adminLevel ?? 'X'}`;
      const adminCode = input?.adminCode ?? input?.featureGroupId;
      const originKey = this.getOriginKeyFromInput(input);
      const originLabel = input?.originLabel;
      const taskId = this.buildProcessingTaskId('extract2', this.resolveTaskIdDetails(task, input));
      inputsByTaskId.set(taskId, {
        inputBufferId: `${this.nodeId}-extract1-${index}`,
        sourceTaskId: task.taskId,
        sourceUrl: input?.sourceUrl,
        featureId,
        featureLabel: input?.featureLabel,
        featureGroupId: input?.featureGroupId,
        featureIndex: input?.featureIndex,
        originKey,
        originLabel,
        adminCode,
        dataSource: input?.dataSource,
        countryCode: input?.countryCode ?? task.countryCode,
        adminLevel: input?.adminLevel ?? task.adminLevel,
        continent: input?.continent,
        countryName: input?.countryName,
      });
      return ({
        taskId,
        nodeId: this.nodeId,
        taskType: 'extract2' as const,
        stage: BatchTaskStage.WAIT,
        type: 'extract2',
        status: 'waiting',
        index,
        progress: 0,
        inputBufferId: `${this.nodeId}-extract1-${index}`,
        countryCode: input?.countryCode ?? task.countryCode,
        countryName: input?.countryName,
        continent: input?.continent,
        adminLevel: input?.adminLevel ?? task.adminLevel,
        adminCode,
      });
    });
    return { tasks, inputsByTaskId };
  }

  private resolveTaskContinent(input?: ShapeExtract1TaskInputData): string | undefined {
    return input?.continent;
  }

  private resolveTaskCountryName(input?: ShapeExtract1TaskInputData): string | undefined {
    const name = input?.countryName;
    return typeof name === 'string' && name.trim() ? name.trim() : undefined;
  }

  private resolveTaskCountryCode(task: Extract1Task, input?: ShapeExtract1TaskInputData): string | undefined {
    const code = input?.countryCode ?? task.countryCode;
    return typeof code === 'string' && code.trim()
      ? code.trim().toUpperCase()
      : undefined;
  }

  private resolveTaskAdminCode(input?: ShapeExtract1TaskInputData): string | undefined {
    const code = input?.adminCode ?? input?.featureGroupId;
    return typeof code === 'string' && code.trim() ? code.trim() : undefined;
  }

  private isSkippedMessage(message?: string | null): boolean {
    if (!message) return false;
    const normalized = message.trim().toLowerCase();
    return normalized === 'skipped' || normalized.startsWith('skipped:');
  }

  private applyFeatureMetadata(
    collection: FeatureCollection,
    meta: {
      continent?: string;
      countryName?: string;
      countryCode?: string;
      adminCode?: string;
      originKey?: string;
    },
  ): FeatureCollection {
    for (const feature of collection.features) {
      if (!feature) continue;
      feature.properties ??= {} as Record<string, unknown>
      const properties = feature.properties;
      if (meta.continent && typeof properties.continent !== 'string') {
        properties.continent = meta.continent;
      }
      if (meta.countryName && typeof properties.countryName !== 'string') {
        properties.countryName = meta.countryName;
      }
      if (meta.countryCode && typeof properties.countryCode !== 'string') {
        properties.countryCode = meta.countryCode;
      }
      if (meta.adminCode && typeof properties.adminCode !== 'string') {
        properties.adminCode = meta.adminCode;
      }
      if (meta.originKey && typeof properties[HDB_ORIGIN_KEY] !== 'string') {
        properties[HDB_ORIGIN_KEY] = meta.originKey;
      }
    }
    return collection;
  }

  private splitGroupByKey<T>(
    items: T[],
    resolveKey: (item: T) => string,
  ): Array<{ key: string; items: T[] }> {
    const groups = new Map<string, T[]>();
    for (const item of items) {
      const key = resolveKey(item);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return Array.from(groups.entries()).map(([key, items]) => ({ key, items }));
  }

  private async buildGroupedExtract2Tasks(
    extract1InputsByTaskId: Map<string, ShapeExtract1TaskInputData>,
  ): Promise<{ tasks: Extract2Task[]; inputsByTaskId: Map<string, ShapeExtract2TaskInputData> }> {
    const maxFeaturesPerGroup = 2000;
    type Candidate = {
      task: Extract1Task;
      continent: string;
      countryName: string;
      countryCode?: string;
      adminCode?: string;
      adminLevel?: number;
      originKey?: string;
      originLabel?: string;
      sourceUrl?: string;
      features: Feature[];
    };
    const candidates: Candidate[] = [];

    for (const task of this.extract1Tasks) {
      const input = extract1InputsByTaskId.get(task.taskId);
      const continent = this.resolveTaskContinent(input);
      const countryName = this.resolveTaskCountryName(input);
      if (!continent || !countryName) {
        console.warn(`[Session ${this.nodeId}] Missing continent/countryName; skipping extract2 task`, {
          taskId: task.taskId,
          continent,
          countryCode: task.countryCode,
          adminLevel: task.adminLevel,
        });
        continue;
      }
      const inputBufferId = `${this.nodeId}-extract1-${task.index ?? 0}`;
      const buffer = await this.artifactStore.getExtractedBuffer(inputBufferId);
      if (!buffer) {
        console.warn(`[Session ${this.nodeId}] Extract1 buffer missing; skipping extract2 task`, {
          taskId: task.taskId,
          inputBufferId,
        });
        continue;
      }
      const collection = await this.decodeFeatureCollection(buffer.data);
      if (!collection || collection.features.length === 0) {
        continue;
      }
      const originKey = this.getOriginKeyFromInput(input);
      const countryCode = this.resolveTaskCountryCode(task, input);
      const adminCode = this.resolveTaskAdminCode(input);
      this.applyFeatureMetadata(collection, {
        continent,
        countryName,
        countryCode,
        adminCode,
        originKey,
      });
      candidates.push({
        task,
        continent,
        countryName,
        countryCode,
        adminCode,
        adminLevel: task.adminLevel,
        originKey,
        originLabel: input?.originLabel,
        sourceUrl: input?.sourceUrl,
        features: collection.features,
      });
    }

    if (candidates.length === 0) {
      return { tasks: [], inputsByTaskId: new Map() };
    }

    const continentGroups = this.splitGroupByKey(
      candidates,
      (entry) => `${extract1InputsByTaskId.get(entry.task.taskId)?.dataSource ?? 'unknown'}|${entry.adminLevel ?? 'NA'}|${entry.continent}`,
    );
    const finalGroups: Array<{ key: string; items: Candidate[] }> = [];

    const sumFeatures = (items: Candidate[]) =>
      items.reduce((total, item) => total + item.features.length, 0);

    for (const group of continentGroups) {
      if (sumFeatures(group.items) <= maxFeaturesPerGroup) {
        finalGroups.push(group);
        continue;
      }
      const countryGroups = this.splitGroupByKey(
        group.items,
        (entry) => `${group.key}|${entry.countryCode ?? 'UNKNOWN'}`,
      );
      for (const countryGroup of countryGroups) {
        if (sumFeatures(countryGroup.items) <= maxFeaturesPerGroup) {
          finalGroups.push(countryGroup);
          continue;
        }
        const adminGroups = this.splitGroupByKey(
          countryGroup.items,
          (entry) => `${countryGroup.key}|${entry.adminCode ?? 'UNKNOWN'}`,
        );
        finalGroups.push(...adminGroups);
      }
    }

    const tasks: Extract2Task[] = [];
    const inputsByTaskId = new Map<string, ShapeExtract2TaskInputData>();
    const newBuffers: Array<{
      id: string;
      nodeId: NodeId;
      stage: 'extract1';
      data: ArrayBuffer;
      featureCount: number;
      extractionRatio: number;
      tolerance: number;
      timestamp: number;
    }> = [];
    for (let index = 0; index < finalGroups.length; index += 1) {
      const group = finalGroups[index];
      const groupFeatures = group?.items.flatMap((item) => item.features);
      if (!groupFeatures || groupFeatures?.length === 0) continue;
      const groupCollection: FeatureCollection = {
        type: 'FeatureCollection',
        features: groupFeatures,
      };
      const groupBufferId = `${this.nodeId}-extract1-group-${index}`;
      const data = await this.encodeFeatureCollection(groupCollection);
      newBuffers.push({
        id: groupBufferId,
        nodeId: this.nodeId,
        stage: 'extract1',
        data,
        featureCount: groupFeatures.length,
        extractionRatio: 1,
        tolerance: 0,
        timestamp: Date.now(),
      });
      const primary = group?.items[0];
      const featureGroupId = `continent-group:${group?.key}`;
      if (!primary) continue;
      const taskId = this.buildProcessingTaskId('extract2', {
        countryCode: primary.countryCode,
        adminLevel: primary.adminLevel,
        featureGroupId,
      });
      tasks.push({
        taskId,
        nodeId: this.nodeId,
        taskType: 'extract2',
        stage: BatchTaskStage.WAIT,
        type: 'extract2',
        status: 'waiting',
        index,
        progress: 0,
        inputBufferId: groupBufferId,
        continent: primary.continent,
        adminLevel: primary.adminLevel,
      });
      inputsByTaskId.set(taskId, {
        inputBufferId: groupBufferId,
        sourceTaskId: primary.task.taskId,
        sourceUrl: primary.sourceUrl,
        featureGroupId,
        adminCode: primary.adminCode,
        originKey: primary.originKey,
        originLabel: primary.originLabel,
        continent: primary.continent,
        dataSource: extract1InputsByTaskId.get(primary.task.taskId)?.dataSource,
        countryCode: primary.countryCode,
        adminLevel: primary.adminLevel,
        countryName: primary.countryName,
      });
    }
    if (newBuffers.length > 0) {
      await this.artifactStore.putExtractedBuffers(newBuffers);
    }
    return { tasks, inputsByTaskId };
  }

  /**
   * Process extract2 stage
   */
  private async processExtract2Stage(): Promise<void> {
    this.currentStage = 'extract2';
    console.log(`[Session ${this.nodeId}] Processing extract2 stage`);

    const zoomLevels = this.resolveZoomLevels();
    const extractionMode = 'topojson';
    const shouldGroupByContinent = extractionMode === 'topojson' && zoomLevels.includes(0);
    const extract1InputsByTaskId = await this.taskRegistry.loadStageInputs<ShapeExtract1TaskInputData>('extract1');
    const extract2Build = shouldGroupByContinent
      ? await this.buildGroupedExtract2Tasks(extract1InputsByTaskId)
      : this.buildExtract2TasksFromExtract1(extract1InputsByTaskId);
    this.extract2Tasks = extract2Build.tasks;
    if (this.extract2Tasks.length === 0) {
      console.warn(`[Session ${this.nodeId}] No extract2 tasks to process`);
      return;
    }
    await this.taskRegistry.registerTasks('extract2', this.extract2Tasks, undefined, extract2Build.inputsByTaskId);
    const { runnableTasks, completedCount, failedCount, total } =
      await this.taskRegistry.resolveStageTasks('extract2', this.extract2Tasks);
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
        currentStage: 'extract2',
        currentTask: 'Extract2 already completed',
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
        currentStage: 'extract2',
      });
    };
    const maxConcurrent = this.config.extract2?.concurrentProcesses ?? this.options.maxConcurrentTasks;
    const r = await this.extract2Adapter!.process(runnableTasks, reportProgress, {
      waitIfPaused: () => this.waitForStageResume('extract2'),
      getSignal: () => this.getStageAbortSignal('extract2'),
      maxConcurrent,
    });
    const extract2Records = await this.taskRegistry.listStageRecords('extract2');
    const skipped = extract2Records.filter((task) => isSkippedMessage(task.message)).length;
    const completed = Math.min(total, baseCompleted + r.processed);
    const failed = Math.min(total - completed, baseFailed + r.failed);
    const done = Math.min(total, completed + failed + skipped);
    this.progressCallback?.({
      total,
      completed,
      failed,
      skipped,
      percentage: total > 0 ? (done / total) * 100 : 0,
      currentStage: 'extract2',
      currentTask: 'Extract2 completed',
    });
    console.log(
      `[Session ${this.nodeId}] Extract2 stage completed: ${baseCompleted + r.processed}/${total} successful`,
    );
    if (isShapePreviewMetadataEnabled()) {
      const statsByOrigin = new Map<string, GeometryStatsSummary>();
      const extract2InputsByTaskId = await this.taskRegistry.loadStageInputs<ShapeExtract2TaskInputData>('extract2');
      for (const task of this.extract2Tasks) {
        const originKey = this.getOriginKeyFromInput(extract2InputsByTaskId.get(task.taskId));
        if (!originKey) continue;
        const bufferId = `${this.nodeId}-extract2-${task.index ?? 0}`;
        const buffer = await this.artifactStore.getExtractedBuffer(bufferId);
        if (!buffer) continue;
        const stats = await this.summarizeBufferStats(buffer.data);
        const existing = statsByOrigin.get(originKey) ?? { vertexCount: 0, polygonCount: 0 };
        statsByOrigin.set(originKey, this.accumulateStats(existing, stats));
      }
      await this.updateSourceMetadataStage('extract2', statsByOrigin);
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
      sourceUrl: output.sourceUrl,
      countryName: output.countryName,
      countryCode,
      continent: output.continent,
      adminLevel,
      featureGroupId: output.featureGroupId,
      featureLabel: output.featureLabel,
      featureIndex: output.featureIndex,
      featureCount: output.featureCount,
    };
  }

  private indexOriginMetadata(outputs: DownloadStageOutput[]): OriginMetadata[] {
    const entries = outputs.map((output) => this.buildOriginMetadata(output));
    this.originMetadataByKey = new Map(entries.map((entry) => [entry.originKey, entry]));
    this.originMetadataByBuffer = new Map(entries.map((entry) => [entry.inputBufferId, entry]));
    return entries;
  }

  private getOriginKeyFromInput(
    input?: ShapeExtract1TaskInputData | ShapeExtract2TaskInputData,
  ): string | undefined {
    return input?.originKey;
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
    const nodeKey = String(this.nodeId);
    const existing = await this.artifactStore.listSourceMetadata();
    const existingByKey = new Map(existing.map((row) => [row.originKey, row]));
    const nextKeys = new Set(entries.map((entry) => entry.originKey));
    const staleIds = existing.filter((row) => !nextKeys.has(row.originKey)).map((row) => row.id);
    if (staleIds.length > 0) {
      await this.artifactStore.deleteSourceMetadataByIds(staleIds);
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
        continent: entry.continent,
        adminLevel: entry.adminLevel,
        featureGroupId: entry.featureGroupId,
        featureLabel: entry.featureLabel,
        createdAt: prior?.createdAt ?? now,
        updatedAt: now,
        rawVertexCount: prior?.rawVertexCount,
        rawPolygonCount: prior?.rawPolygonCount,
        extract1VertexCount: prior?.extract1VertexCount,
        extract1PolygonCount: prior?.extract1PolygonCount,
        extract2VertexCount: prior?.extract2VertexCount,
        extract2PolygonCount: prior?.extract2PolygonCount,
        vectorTileVertexCount: prior?.vectorTileVertexCount,
        vectorTilePolygonCount: prior?.vectorTilePolygonCount,
        bbox: prior?.bbox,
      };
    });
    if (rows.length > 0) {
      await this.artifactStore.putSourceMetadata(rows);
    }
  }

  private async updateSourceMetadataStage(
    stage: 'raw' | 'extract1' | 'extract2' | 'vectorTile',
    statsByOrigin: Map<string, GeometryStatsSummary>,
  ): Promise<void> {
    if (statsByOrigin.size === 0) return;
    const nodeKey = String(this.nodeId);
    const existing = await this.artifactStore.listSourceMetadata();
    const existingByKey = new Map(existing.map((row) => [row.originKey, row]));
    const now = Date.now();
    const rows: ShapeSourceMetadataRow[] = [];
    for (const [originKey, stats] of statsByOrigin.entries()) {
      const prior = existingByKey.get(originKey);
      const base = this.originMetadataByKey.get(originKey);
      if (!prior && !base) continue;
      const bbox = (stage === 'raw' || stage === 'extract2')
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
        continent: prior?.continent ?? base?.continent,
        adminLevel: prior?.adminLevel ?? base?.adminLevel,
        featureGroupId: prior?.featureGroupId ?? base?.featureGroupId,
        featureLabel: prior?.featureLabel ?? base?.featureLabel,
        createdAt: prior?.createdAt ?? now,
        updatedAt: now,
        rawVertexCount: stage === 'raw' ? stats.vertexCount : prior?.rawVertexCount,
        rawPolygonCount: stage === 'raw' ? stats.polygonCount : prior?.rawPolygonCount,
        extract1VertexCount: stage === 'extract1' ? stats.vertexCount : prior?.extract1VertexCount,
        extract1PolygonCount: stage === 'extract1' ? stats.polygonCount : prior?.extract1PolygonCount,
        extract2VertexCount: stage === 'extract2' ? stats.vertexCount : prior?.extract2VertexCount,
        extract2PolygonCount: stage === 'extract2' ? stats.polygonCount : prior?.extract2PolygonCount,
        vectorTileVertexCount: stage === 'vectorTile' ? stats.vertexCount : prior?.vectorTileVertexCount,
        vectorTilePolygonCount: stage === 'vectorTile' ? stats.polygonCount : prior?.vectorTilePolygonCount,
        bbox,
      });
    }
    if (rows.length > 0) {
      await this.artifactStore.putSourceMetadata(rows);
    }
  }

  private async summarizeVectorTilesByOrigin(): Promise<Map<string, GeometryStatsSummary>> {
    const statsByOrigin = new Map<string, GeometryStatsSummary>();
    const rows = await this.artifactStore.listVectorTileRows();
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
    const tilesByKey = new Map<string, { key: string; z: number; x: number; y: number; features: Feature[] }>();
    const metadataRecords: ShapeFeatureMetadataRow[] = [];
    const createdAt = Date.now();

    for (const task of this.extract2Tasks) {
      const inputBufferId = task.inputBufferId ?? `${this.nodeId}-extract2-${task.index ?? 0}`;
      const buffer = await this.artifactStore.getExtractedBuffer(inputBufferId);
      if (!buffer) continue;
      const collection = await this.decodeFeatureCollection(buffer.data);
      if (!collection) continue;
      for (let index = 0; index < collection.features.length; index++) {
        const feature = collection.features[index];
        if (!feature) continue;
        feature.properties ??= {};
        const properties = feature.properties;
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
      await this.artifactStore.putFeatureMetadata(metadataRecords);
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
  ): { tasks: VectorTileTask[]; inputsByTaskId: Map<string, ShapeVectorTileTaskInputData> } {
    const tileSize = this.config.vectorTiles?.tileSize ?? this.config.tileSize ?? 256;
    const buffer = this.config.vectorTiles?.bufferSize ?? 256;
    const minZoom = this.config.vectorTiles?.minZoom ?? 0;
    const maxZoom = this.config.vectorTiles?.maxZoom ?? 10;
    const metadataEnabled = false;
    const inputsByTaskId = new Map<string, ShapeVectorTileTaskInputData>();
    const tasks: VectorTileTask[] = tileRows.map((tile, index) => {
      const taskId = `${this.nodeId}-vectortile-${index}`;
      inputsByTaskId.set(taskId, {
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
      });
      return {
        taskId,
        nodeId: this.nodeId,
        taskType: 'vectortile' as const,
        stage: BatchTaskStage.WAIT,
        type: 'vectortile',
        status: 'waiting',
        index,
        progress: 0,
      };
    });
    return { tasks, inputsByTaskId };
  }

  private async persistPlaceholderMetadata(replace: boolean): Promise<number> {
    if (!isShapePreviewMetadataEnabled()) return 0;
    const nodeKey = String(this.nodeId);
    if (replace) {
      await this.artifactStore.deleteFeatureMetadataByNode();
    }
    const existing = replace
      ? new Set<string>()
      : new Set(
        (await this.artifactStore.listFeatureMetadata()).map((row) => row.featureId),
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
      await this.artifactStore.putFeatureMetadata(rows);
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
    const vectorTileBuild = this.buildVectorTileTasks(tileRows);
    const tasks = vectorTileBuild.tasks;
    if (tasks.length === 0) {
      console.warn(`[Session ${this.nodeId}] No vector tile tasks to process`);
      return;
    }

    await this.taskRegistry.registerTasks('vectortile', tasks, undefined, vectorTileBuild.inputsByTaskId);
    const { runnableTasks, completedCount, failedCount, total } =
      await this.taskRegistry.resolveStageTasks('vectortile', tasks);
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
    const maxConcurrent = this.extract2RetryOverride > 0
      ? 1
      : (baseConcurrent ?? 1);
    const r = await this.vectorTileAdapter!.process(runnableTasks, reportProgress, {
      waitIfPaused: () => this.waitForStageResume('vectortile'),
      getSignal: () => this.getStageAbortSignal('vectortile'),
      maxConcurrent,
      requestPause: (message) => this.requestPause('vectortile', message),
    });
    await this.persistPlaceholderMetadata(false);
    await this.syncVectorTilesToShapeStore();
    if (isShapePreviewMetadataEnabled()) {
      const statsByOrigin = await this.summarizeVectorTilesByOrigin();
      await this.updateSourceMetadataStage('vectorTile', statsByOrigin);
    }
    this.vectorTileAdapter?.clearFeatureCache?.(String(this.nodeId));
    console.log(
      `[Session ${this.nodeId}] Vector tile stage completed: ${baseCompleted + r.processed}/${total} successful`,
    );
  }

  private async prepareExtract2Retry(retry: number): Promise<void> {
    this.extract2RetryOverride = retry;
    await this.taskRegistry.prepareExtract2Retry(retry);
    await this.taskRegistry.resetVectorTileTasksForRetry();
    this.vectorTileAdapter?.clearFeatureCache?.(String(this.nodeId));
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
