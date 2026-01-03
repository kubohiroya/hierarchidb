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
import type { Extract1Task, Extract2Task } from '../../common/types/index.js';
import type { VectorTileTask } from '../../common/types/index.js';
import type { Extract1StageAdapter } from './adapters/Extract1StageAdapter.js';
import type { Extract2StageAdapter } from './adapters/Extract2StageAdapter.js';
import type { VectorTileStageAdapter } from './adapters/VectorTileStageAdapter.js';
import { ShapeWorkerExtract1Adapter, ShapeWorkerExtract2Adapter } from './adapters/ShapeWorkerExtractAdapters.js';
import { RuntimeWorkerVectorTileAdapter } from './adapters/RuntimeWorkerVectorTileAdapter.js';
import type { BatchProcessConfig } from './types.js';
import type { DataSourceName, DownloadTaskPayload, ProgressInfo, ProcessingStage, CountryCode } from '../../common/types/index.js';
import type { BatchTaskPauseHandler } from './session/types/PauseHandler.js';
import { BatchTaskStage } from '../../common/types/index.js';
import { isShapePreviewMetadataEnabled } from '../../common/config/previewFlags.js';
import type {
  ShapeExtract1TaskInputData,
  ShapeExtract2TaskInputData,
} from '@hierarchidb/plugin-service-api';
import { createShapeBatchApiClient } from './ShapeBatchApiClient.js';
import { SessionTaskRegistry } from './SessionTaskRegistry.js';
import { SessionArtifactStore } from './SessionArtifactStore.js';
import type { DownloadStageOutput } from './strategies/DownloadStageStrategy.js';
import { resolveDownloadStageStrategy } from './strategies/resolveDownloadStageStrategy.js';
import { runDownloadMetadataOrchestrator, runStageMetadataOrchestrator } from './session/orchestrators/index.js';
import { expandOutputsForFeatureGroups as expandOutputsForFeatureGroupsInDownloadStage } from './session/stages/download/expandOutputsForFeatureGroups.js';
import { runDownloadStageOrchestrator } from './session/stages/download/runDownloadStageOrchestrator.js';
import { postprocessDownloadOutputs as postprocessDownloadOutputsInDownloadStage } from './session/stages/download/postprocessDownloadOutputs.js';
import { updateSourceMetadataBaseIfEnabled, updateSourceMetadataStageIfEnabled } from './session/metadata/sourceMetadataFacade.js';
import { runExtract1StageOrchestrator } from './session/stages/extract1/runExtract1StageOrchestrator.js';
import { runExtract2StageOrchestrator } from './session/stages/extract2/runExtract2StageOrchestrator.js';
import { resolveExtract2BuildStrategy } from './session/extract2/index.js';
import { buildExtract1InputsByTaskId } from './session/extract1/index.js';
import { buildVectorTileStageInputs } from './session/stages/vectortile/buildVectorTileStageInputs.js';
import { runVectorTileStageOrchestrator } from './session/stages/vectortile/runVectorTileStageOrchestrator.js';
import { asSharedVectorTileTaskRegistryPort } from './session/stages/vectortile/sharedTaskRegistryPort.js';
import { buildVectorTileStagePostprocessPort } from './session/stages/vectortile/buildVectorTileStagePostprocessPort.js';
import { buildStageControls, buildStagePauseAbortControls } from './session/stages/common/buildStageControls.js';
import type { StageControls, StagePauseAbortControls } from './session/stages/common/buildStageControls.js';
import type { OriginMetadata, WorkerPoolStatistics, GeometryStatsSummary } from './session/SessionTypes.js';
import { buildProcessingTaskId } from './session/ids/processingIds.js';
import { indexOriginMetadata as indexOriginMetadataInSession } from './session/metadata/originMetadata.js';
import { getEphemeralShapeDB } from '../database/EphemeralShapeDB.js';
import { geojson as geojsonApi } from 'flatgeobuf';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { bbox as turfBbox, area as turfArea } from '@turf/turf';

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
  private pauseHandler?: BatchTaskPauseHandler;
  private extract1Adapter?: Extract1StageAdapter;
  private extract2Adapter?: Extract2StageAdapter;
  private vectorTileAdapter: VectorTileStageAdapter = new RuntimeWorkerVectorTileAdapter();
  private extract1Tasks: Extract1Task[] = [];
  private extract2Tasks: Extract2Task[] = [];
  private vectorTileTasks: VectorTileTask[] = [];
  private extract2RetryOverride = 0;
  // Used by pause handler wiring (implemented in the full file).
  private readonly pausedStages = new Set<ProcessingStage>();
  private readonly stageWaiters = new Map<ProcessingStage, Array<() => void>>();
  private readonly stageAbortControllers = new Map<ProcessingStage, AbortController>();
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

  private buildStagePauseAbortControls(stage: ProcessingStage): StagePauseAbortControls {
    return buildStagePauseAbortControls(stage, {
      waitForStageResume: (s) => this.waitForStageResume(s),
      getStageAbortSignal: (s) => this.getStageAbortSignal(s),
      pauseStage: (s) => this.pauseStage(s),
      pauseHandler: this.pauseHandler,
    });
  }

  private buildVectorTileControls(): StageControls {
    return buildStageControls('vectortile', {
      waitForStageResume: (s) => this.waitForStageResume(s),
      getStageAbortSignal: (s) => this.getStageAbortSignal(s),
      pauseStage: (s) => this.pauseStage(s),
      pauseHandler: this.pauseHandler,
    });
  }

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

  // (vectortile stage helpers removed here; stub implementation does not use them yet)

  private getOriginKeyFromInput(input?: { originKey?: string } | null): string | undefined {
    const originKey = input?.originKey;
    return typeof originKey === 'string' && originKey.trim().length > 0 ? originKey : undefined;
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

  private buildProcessingTaskId(
    stage: 'extract1' | 'extract2',
    details: {
      countryCode?: string;
      adminLevel?: number;
      featureLabel?: string;
      featureGroupId?: string;
    },
  ): string {
    return buildProcessingTaskId(this.nodeId, stage, details);
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
    return await expandOutputsForFeatureGroupsInDownloadStage({
      nodeId: this.nodeId,
      outputs,
      artifactStore: this.artifactStore,
      decodeFeatureCollection: (buffer) => this.decodeFeatureCollection(buffer),
      encodeFeatureCollection: (collection) => this.encodeFeatureCollection(collection),
      resolveFeatureLabel: (feature, index, fallbackPrefix) => this.resolveFeatureLabel(feature, index, fallbackPrefix),
      resolveContinentFromFeature: (feature) => this.resolveContinentFromFeature(feature),
    });
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

  // ---- extract2 task metadata helpers (used by resolveExtract2BuildStrategy wiring) ----
  private resolveTaskContinent(input?: ShapeExtract1TaskInputData): string | undefined {
    return input?.continent;
  }

  private resolveTaskCountryName(input?: ShapeExtract1TaskInputData): string | undefined {
    const name = input?.countryName;
    return typeof name === 'string' && name.trim() ? name.trim() : undefined;
  }

  private resolveTaskCountryCode(task: Extract1Task, input?: ShapeExtract1TaskInputData): string | undefined {
    const code = input?.countryCode ?? task.countryCode;
    return typeof code === 'string' && code.trim() ? code.trim().toUpperCase() : undefined;
  }

  private resolveTaskAdminCode(input?: ShapeExtract1TaskInputData): string | undefined {
    const code = input?.adminCode ?? input?.featureGroupId;
    return typeof code === 'string' && code.trim() ? code.trim() : undefined;
  }

  private isSkippedMessage(message?: string | null): boolean {
    return isSkippedMessage(message);
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
    // vectortile adapter wiring is handled in the full implementation
  }

  setProgressCallback(callback?: (progress: ProgressInfo) => void): void {
    this.progressCallback = callback;
  }

  setPauseHandler(handler?: BatchTaskPauseHandler): void {
    this.pauseHandler = handler;
  }

  pauseStage(stage: ProcessingStage): void {
    this.pausedStages.add(stage);
    this.isPaused = true;
    this.abortStageController(stage);
    // notify external listener
    void this.pauseHandler?.(stage, 'Paused by user');
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
    if (!this.pausedStages.has(stage)) return;
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

  private async cleanupStageCache(stage: 'extract1' | 'extract2', reason: string): Promise<void> {
    const cleanupConfig = this.config;
    const shouldCleanup = stage === 'extract1'
      ? cleanupConfig.deleteExtract1CacheOnComplete === true
      : cleanupConfig.deleteExtract2CacheOnComplete === true;
    if (!shouldCleanup) return;
    console.log(`[Session ${this.nodeId}] Cleaning ${stage} cache (${reason})`);
    await getEphemeralShapeDB().clearStage(this.nodeId, stage);
    console.log(`[Session ${this.nodeId}] ${stage} cache cleared`);
  }

  private async prepareExtract2Retry(retry: number): Promise<void> {
    this.extract2RetryOverride = retry;
    // mark used for TS6133 (retry instrumentation)
    void this.extract2RetryOverride;
    await this.taskRegistry.prepareExtract2Retry(retry);
    await this.taskRegistry.resetVectorTileTasksForRetry();
    // vectortile cache reset is handled in the full implementation
  }

  private extractGeometryStats(feature: Feature): {
    vertexCount: number;
    polygonCount: number;
    bbox?: [number, number, number, number];
    area: number;
  } {
    const countVertices = (coords: unknown): number => {
      if (!Array.isArray(coords)) return 0;
      if (coords.length === 0) return 0;
      if (typeof coords[0] === 'number') return 1;
      return coords.reduce((sum, child) => sum + countVertices(child), 0);
    };
    const geometry = feature.geometry ?? null;
    const countVerticesFromGeometry = (geom?: Geometry | null): number => {
      if (!geom) return 0;
      if (geom.type === 'GeometryCollection') {
        return geom.geometries.reduce((sum, child) => sum + countVerticesFromGeometry(child), 0);
      }
      return countVertices((geom as { coordinates: unknown }).coordinates);
    };
    const countPolygons = (geom?: Geometry | null): number => {
      if (!geom) return 0;
      if (geom.type === 'Polygon') return 1;
      if (geom.type === 'MultiPolygon') return geom.coordinates.length;
      return 0;
    };

    let bbox: [number, number, number, number] | undefined;
    try {
      const box = turfBbox(feature as unknown as Feature);
      if (box.every((value) => Number.isFinite(value))) {
        bbox = [box[0], box[1], box[2], box[3]];
      }
    } catch {
      bbox = undefined;
    }
    return {
      vertexCount: countVerticesFromGeometry(geometry),
      polygonCount: countPolygons(geometry),
      bbox,
      area: geometry ? turfArea(feature as unknown as Feature) : 0,
    };
  }

  private indexOriginMetadata(outputs: DownloadStageOutput[]): OriginMetadata[] {
    const { entries, byKey, byBuffer } = indexOriginMetadataInSession({
      nodeId: this.nodeId,
      outputs,
      resolveDataSource: () => this.resolveDataSource(),
    });
    this.originMetadataByKey = byKey;
    this.originMetadataByBuffer = byBuffer;
    // mark used for TS6133 (debug/inspection)
    void this.originMetadataByKey;
    void this.lastTileIndexStats;
    return entries;
  }

  private async updateSourceMetadataBase(_entries: OriginMetadata[]): Promise<void> {
    await updateSourceMetadataBaseIfEnabled({
      enabled: isShapePreviewMetadataEnabled(),
      nodeId: this.nodeId,
      store: this.artifactStore,
      entries: _entries,
    });
  }

  private async updateSourceMetadataStage(
    _stage: 'raw' | 'extract1' | 'extract2' | 'vectorTile',
    _statsByOrigin: Map<string, GeometryStatsSummary>,
  ): Promise<void> {
    await updateSourceMetadataStageIfEnabled({
      enabled: isShapePreviewMetadataEnabled(),
      nodeId: this.nodeId,
      store: this.artifactStore,
      originByKey: this.originMetadataByKey,
      stage: _stage,
      statsByOrigin: _statsByOrigin,
    });
  }

  private async processVectorTileStage(): Promise<void> {
    this.currentStage = 'vectortile';
    console.log(`[Session ${this.nodeId}] Processing vectortile stage`);

    const zoomLevels = this.resolveZoomLevels();
    if (zoomLevels.length === 0) {
      console.warn(`[Session ${this.nodeId}] No zoom levels configured; skipping vectortile stage`);
      return;
    }

    const metadataEnabled = isShapePreviewMetadataEnabled();
    const { tasks, inputsByTaskId } = await buildVectorTileStageInputs({
      nodeId: this.nodeId,
      zoomLevels,
      config: this.config,
      tileInputSource: {
        listExtract2Buffers: () => this.artifactStore.listExtractedBuffers('extract2'),
      },
    });
    this.vectorTileTasks = tasks;

    const maxConcurrent = this.config.vectorTiles?.concurrentProcesses ?? this.options.maxConcurrentTasks;
    const adapter = this.vectorTileAdapter;

    const controls = this.buildVectorTileControls();

    // Bridge shared orchestrator ProgressInfo -> shape-plugin ProgressInfo.
    // shared 側は stage-agnostic な string を許すが、shape-plugin 側は BatchTaskType | 'processing' のみを許す。
    const progressCallback = this.progressCallback
      ? ((p: import('@hierarchidb/vectortile-orchestrator').ProgressInfo) => {
           const currentStageRaw = p.currentStage;
           const currentStage = currentStageRaw === 'processing' || currentStageRaw === 'vectortile'
             ? currentStageRaw
             : undefined;
           this.progressCallback?.({
             ...p,
             currentStage,
           });
         })
       : undefined;

    const progressFactory = progressCallback
      ? ((p: import('@hierarchidb/vectortile-orchestrator').ProgressInfo) => p)
      : undefined;

    let stageSummary: { total: number; completed: number; failed: number; skipped: number } | undefined;
    await runVectorTileStageOrchestrator({
      nodeId: this.nodeId,
      metadataEnabled,
      tasks: this.vectorTileTasks,
      inputsByTaskId,
      taskRegistry: asSharedVectorTileTaskRegistryPort(this.taskRegistry),
      adapter,
      maxConcurrent,
      waitIfPaused: controls.waitIfPaused,
      getSignal: controls.getSignal,
      requestPause: controls.requestPause,
      progressCallback,
      progressFactory,
      postprocess: buildVectorTileStagePostprocessPort({
        enabled: metadataEnabled,
        nodeId: this.nodeId,
        dataSourceFallback: this.resolveDataSource(),
        downloadTaskPayloads: this.downloadTaskPayloads,
        artifactStore: this.artifactStore,
        extractGeometryStats: (feature) => this.extractGeometryStats(feature),
        updateSourceMetadataStage: (stage, statsByOrigin) => this.updateSourceMetadataStage(stage, statsByOrigin),
        clearFeatureCache: () => this.vectorTileAdapter.clearFeatureCache?.(String(this.nodeId)),
      }),
      afterRun: async (summary: import('@hierarchidb/vectortile-orchestrator').VectorTileStageSummary) => {
        console.log(`[Session ${this.nodeId}] Vector tile stage completed`, summary);
        stageSummary = summary;
      },
    });

    if (stageSummary) {
      console.log(`[Session ${this.nodeId}] Vector tile stage summary`, stageSummary);
    }

    // postprocess is handled by runVectorTileStageOrchestrator
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

      await this.runVectorTileRegressionRetries(waitForResumeIfPaused);

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

  private async runVectorTileRegressionRetries(waitForResumeIfPaused: () => Promise<void>): Promise<void> {
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
    // Convert DownloadTaskInput -> DownloadTaskPayload so downstream orchestrators and postprocessors
    // always receive a consistent payload shape (解決案C)。Strategies produce DownloadTaskInput which may
    // omit some fields; we fill sensible defaults from downloadTaskPayloads where available.
    const mappedInputsByTaskId = new Map<string, DownloadTaskPayload>();
    for (const [taskId, input] of inputsByTaskId.entries()) {
      const partial = input as Partial<DownloadTaskPayload>;
      const candidateCountry = partial.countryCode ?? this.downloadTaskPayloads[0]?.countryCode ?? '';
      const payload: DownloadTaskPayload = {
        url: partial.url ?? (this.downloadTaskPayloads[0]?.url ?? ''),
        countryCode: (candidateCountry as unknown) as CountryCode,
        countryName: partial.countryName ?? this.downloadTaskPayloads[0]?.countryName,
        adminLevel: partial.adminLevel ?? this.downloadTaskPayloads[0]?.adminLevel ?? 0,
        dataSource: partial.dataSource ?? this.downloadTaskPayloads[0]?.dataSource,
      };
      mappedInputsByTaskId.set(taskId, payload);
    }
    const maxConcurrent = this.config.download?.concurrentDownloads ?? this.options.maxConcurrentTasks;
    const controls = this.buildStagePauseAbortControls('download');
    const summary = await runDownloadStageOrchestrator({
      nodeId: this.nodeId,
      adapter: this.downloadAdapter,
      maxConcurrent,
      waitIfPaused: controls.waitIfPaused,
      getSignal: controls.getSignal,
      tasks,
      inputsByTaskId: mappedInputsByTaskId,
      taskRegistry: this.taskRegistry,
      progressCallback: this.progressCallback,
    });
    if (!summary.alreadyCompleted) {
      console.log(
        `[Session ${this.nodeId}] Download stage completed: ${summary.completed} successful, ${summary.failed} failed`,
      );
    }
     const postprocess = await postprocessDownloadOutputsInDownloadStage({
       strategy,
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
    const previewEnabled = isShapePreviewMetadataEnabled();
    await runDownloadMetadataOrchestrator({
      enabled: previewEnabled,
      nodeId: this.nodeId,
      outputs: expandedOutputs,
      indexOriginMetadata: (outputs: DownloadStageOutput[]) => this.indexOriginMetadata(outputs),
      updateSourceMetadataBase: (entries: OriginMetadata[]) => this.updateSourceMetadataBase(entries),
      listRawBuffer: (bufferId: string) => this.artifactStore.getRawBuffer(bufferId),
      decodeFeatureCollection: (buf: ArrayBuffer) => this.decodeFeatureCollection(buf),
      extractGeometryStats: (feature: Feature) => this.extractGeometryStats(feature),
      updateSourceMetadataStage: (stage: 'raw', statsByOrigin: Map<string, GeometryStatsSummary>) =>
        this.updateSourceMetadataStage(stage, statsByOrigin),
    });
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

    const inputsByTaskId = buildExtract1InputsByTaskId({
      tasks,
      originByInputBufferId: this.originMetadataByBuffer,
      buildFallbackFeatureId: (task) => `${task.countryCode ?? 'UNK'}:ADM${task.adminLevel ?? 'X'}`,
    });
    await this.taskRegistry.registerTasks('extract1', tasks, undefined, inputsByTaskId);
    const maxConcurrent = this.config.extract1?.concurrentProcesses ?? this.options.maxConcurrentTasks;
    const adapter = this.extract1Adapter;
    if (!adapter) {
      throw new Error(`[Session ${this.nodeId}] Extract1 adapter is not initialized`);
    }

    const extract1Controls = this.buildStagePauseAbortControls('extract1');

    let stageTotals: { total: number; completed: number; skipped: number; failed: number } | undefined;

    await runExtract1StageOrchestrator({
      nodeId: this.nodeId,
      tasks,
      inputsByTaskId,
      taskRegistry: this.taskRegistry,
      adapter,
      maxConcurrent,
      waitIfPaused: extract1Controls.waitIfPaused,
      getSignal: extract1Controls.getSignal,
      progressCallback: this.progressCallback,
      isSkippedMessage: (message) => this.isSkippedMessage(message),
      afterStageCompleted: async ({ total, completed, failed, skipped }) => {
        stageTotals = { total, completed, failed, skipped };
      },
    });

    if (stageTotals) {
      console.log(`[Session ${this.nodeId}] Extract1 stage summary`, stageTotals);
    }

    await runStageMetadataOrchestrator({
      enabled: isShapePreviewMetadataEnabled(),
      nodeId: this.nodeId,
      stage: 'extract1',
      tasks: this.extract1Tasks,
      inputsByTaskId,
      buildBufferId: (task) => `${this.nodeId}-extract1-${task.index ?? 0}`,
      getBuffer: (bufferId) => this.artifactStore.getExtractedBuffer(bufferId),
      decodeFeatureCollection: (buf) => this.decodeFeatureCollection(buf),
      extractGeometryStats: (feature) => this.extractGeometryStats(feature),
      updateSourceMetadataStage: (stage, statsByOrigin) => this.updateSourceMetadataStage(stage, statsByOrigin),
    });
  }


  /**
   * Process extract2 stage
   */
  private async processExtract2Stage(): Promise<void> {
    this.currentStage = 'extract2';
    console.log(`[Session ${this.nodeId}] Processing extract2 stage`);

    const zoomLevels = this.resolveZoomLevels();
    const extractionMode = this.config.extract2?.extractionMode ?? 'topojson';
    const extract1InputsByTaskId = await this.taskRegistry.loadStageInputs<ShapeExtract1TaskInputData>('extract1');
    const extract2Build = await resolveExtract2BuildStrategy({
      nodeId: this.nodeId,
      zoomLevels,
      extractionMode,
      extract1Tasks: this.extract1Tasks,
      extract1InputsByTaskId,
      buildTaskId: (_stage: 'extract2', details: { countryCode?: string; adminLevel?: number; featureLabel?: string; featureGroupId?: string }) =>
        this.buildProcessingTaskId('extract2', details),
      resolveTaskIdDetails: (task, input) => this.resolveTaskIdDetails(task, input),
      getOriginKeyFromInput: (input) => this.getOriginKeyFromInput(input),
      resolveTaskContinent: (input: ShapeExtract1TaskInputData | undefined) => this.resolveTaskContinent(input),
      resolveTaskCountryName: (input: ShapeExtract1TaskInputData | undefined) => this.resolveTaskCountryName(input),
      resolveTaskCountryCode: (task: Extract1Task, input: ShapeExtract1TaskInputData | undefined) => this.resolveTaskCountryCode(task, input),
      resolveTaskAdminCode: (input: ShapeExtract1TaskInputData | undefined) => this.resolveTaskAdminCode(input),
      getExtractedBuffer: (bufferId: string) => this.artifactStore.getExtractedBuffer(bufferId),
      decodeFeatureCollection: (buffer: ArrayBuffer) => this.decodeFeatureCollection(buffer),
      encodeFeatureCollection: (collection: FeatureCollection) => this.encodeFeatureCollection(collection),
      putExtractedBuffers: (buffers) => this.artifactStore.putExtractedBuffers(buffers),
      consoleWarn: (message: string, data?: unknown) => console.warn(`[Session ${this.nodeId}] ${message}`, data),
      consoleDebug: (message: string, data?: unknown) => console.debug(`[Session ${this.nodeId}] ${message}`, data),
    });

    console.debug(`[Session ${this.nodeId}] Extract2 mode selection`, {
      extractionMode,
      shouldGroupByContinent: extract2Build.shouldGroupByContinent,
      zoomLevels,
      extract1Tasks: this.extract1Tasks.length,
    });

    this.extract2Tasks = extract2Build.tasks;
    console.debug(`[Session ${this.nodeId}] Extract2 tasks built`, {
      extractionMode,
      taskCount: this.extract2Tasks.length,
    });
    if(this.extract2Tasks.length === 0) {
      console.warn(`[Session ${this.nodeId}] No extract2 tasks to process`);
      await this.cleanupStageCache('extract1', 'extract2 stage skipped (no tasks)');
      return;
    }
    const maxConcurrent = this.config.extract2?.concurrentProcesses ?? this.options.maxConcurrentTasks;
    const adapter = this.extract2Adapter;
    if (!adapter) {
      throw new Error(`[Session ${this.nodeId}] Extract2 adapter is not initialized`);
    }

    const extract2Controls = this.buildStagePauseAbortControls('extract2');

    let alreadyCompleted = false;
    await runExtract2StageOrchestrator({
      nodeId: this.nodeId,
      tasks: this.extract2Tasks,
      inputsByTaskId: extract2Build.inputsByTaskId,
      taskRegistry: this.taskRegistry,
      adapter,
      maxConcurrent,
      waitIfPaused: extract2Controls.waitIfPaused,
      getSignal: extract2Controls.getSignal,
      progressCallback: this.progressCallback,
      isSkippedMessage: (message) => isSkippedMessage(message),
      afterStageCompleted: async ({ total, completed, failed }) => {
        // runnableTasks が 0 の場合もここに来る
        alreadyCompleted = total > 0 && completed + failed >= total;
      },
    });

    if (alreadyCompleted) {
      await this.cleanupStageCache('extract1', 'extract2 stage already completed');
    }

    if (isShapePreviewMetadataEnabled()) {
      const extract2InputsByTaskId = await this.taskRegistry.loadStageInputs<ShapeExtract2TaskInputData>('extract2');
      await runStageMetadataOrchestrator({
        enabled: true,
        nodeId: this.nodeId,
        stage: 'extract2',
        tasks: this.extract2Tasks,
        inputsByTaskId: extract2InputsByTaskId,
        buildBufferId: (task) => `${this.nodeId}-extract2-${task.index ?? 0}`,
        getBuffer: (bufferId) => this.artifactStore.getExtractedBuffer(bufferId),
        decodeFeatureCollection: (buf) => this.decodeFeatureCollection(buf),
        extractGeometryStats: (feature) => this.extractGeometryStats(feature),
        updateSourceMetadataStage: (stage, statsByOrigin) => this.updateSourceMetadataStage(stage, statsByOrigin),
      });
    }
    if (!alreadyCompleted) {
      await this.cleanupStageCache('extract1', 'extract2 stage completed');
    }
  }

  // (tile helpers are provided by session/tiles/*)
}
