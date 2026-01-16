/**
 * Worker API implementation for Shape plugin
 * Exposes batch-oriented operations for runtime worker adapters
 */

import { toNodeId, type NodeId, type TaskQueueRecord } from '@hierarchidb/common-types';
import type { ShapeBuildConfig } from '../common/types/index.js';
import {
  type BatchSession,
  type BuildTask,
  type CountryMetadata,
  type DataSourceConfig,
  type DataSourceName,
  SHAPE_DATA_SOURCES,
  mergeBuildConfig,
  type ProcessingStatus,
  type ProgressInfo,
  type TileInfo,
  type FetchTaskPayload,
  validateBatchConfig,
  type ShapeStepValidationResult,
  BuildTaskResult,
  type BuildTaskResultType,
  type ShapeEntity,
  type SelectedArrayByCountries,
} from '../common/types/index.js';
import { ShapeEntityHandler } from './handlers/index.js';

import { metadataLoader } from '../services/metadata/MetadataLoader.js';
import type { BatchProgressEvent, BatchProgressPayload } from '@hierarchidb/common-api';
import {
  generateDownloadTaskPayloads,
  getPreferredCountryCodeFormat,
} from '../services/utils/utils.js';
import { bufferDeserializer, bufferSerializer, createShapeChunkStore } from '../services/utils/chunkStore.js';
import { normalizeCountryCodeFormat } from '../services/utils/iso3166.js';
import { resolveFetchStageStrategy } from '../services/batch/strategies/resolveFetchStageStrategy.ts';
import {
  VtTaskQueueDb,
  listTasks,
  listTasksByStatus,
  onTaskQueueUpdate,
  updateTask,
} from '@hierarchidb/vt-orchestrator';
import { VtShapeDb, listFetchCache } from '@hierarchidb/vt-shape-store';
import { ephemeralShapeDB } from '@hierarchidb/shape-store';
import { runShapeVtPipeline } from '../services/vt/shapeVtPipeline.js';
import { shapeMutationAPIImpl, shapeQueryAPIImpl } from '../services/batch/ShapeBuildAPIClient.ts';

type DraftLike = {
  nodeId?: NodeId;
  treeNodeId?: NodeId;
  draftData?: Partial<ShapeEntity>;
};

const resolveBatchNodeId = (draft: DraftLike | null | undefined): NodeId | undefined => {
  const resolved = draft?.nodeId ?? draft?.treeNodeId ?? draft?.draftData?.nodeId;
  return resolved ? toNodeId(String(resolved)) : undefined;
};

const buildBuildSessionConfig = (buildConfig: ShapeBuildConfig): ShapeBuildConfig => {
 const resolvedDataSource = requireDataSourceName(
    buildConfig.dataSourceName,
    'buildBuildSessionConfig',
  );

  return {
    dataSourceName: resolvedDataSource,
    fetchConfig: buildConfig.fetchConfig,
    transformConfig: buildConfig.transformConfig,
    vtConfig: buildConfig.vtConfig,
  };
};

interface ProgressSubscription {
  unsubscribe?: () => void;
  callback?: (event: BatchProgressEvent) => void;
}

type PauseState = {
  paused: boolean;
  waiters: Array<() => void>;
};

const progressCallbacks = new Map<string, ProgressSubscription>();
const pauseStates = new Map<string, PauseState>();
const activePipelines = new Set<string>();

const shapeEntityHandlerSingleton = new ShapeEntityHandler();
const getShapeEntityHandler = (): ShapeEntityHandler => shapeEntityHandlerSingleton;

const isSkippedMessage = (message?: string | null): boolean => {
  if (!message) return false;
  const normalized = message.trim().toLowerCase();
  return normalized === 'skipped' || normalized.startsWith('skipped:');
};

const resolveTaskProgress = (task: TaskQueueRecord): number => {
  if (task.stage !== 'transform') {
    return task.progress ?? 0;
  }
  const output = task.outputData as Record<string, unknown> | undefined;
  const processed = typeof output?.processedPolygons === 'number' ? output.processedPolygons : null;
  const total = typeof output?.totalPolygons === 'number' ? output.totalPolygons : null;
  if (processed !== null && total !== null && total > 0) {
    return Math.min(100, Math.max(0, Math.round((processed / total) * 100)));
  }
  return task.progress ?? 0;
};

const mapTaskQueueStatusToStage = (status: TaskQueueRecord['status']): BuildTaskResultType => {
  switch (status) {
    case 'queued':
      return BuildTaskResult.WAIT;
    case 'running':
      return BuildTaskResult.PROCESS;
    case 'completed':
      return BuildTaskResult.SUCCESS;
    case 'failed':
    default:
      return BuildTaskResult.ERROR;
  }
};

const mapTaskQueueStatusToTaskStatus = (status: TaskQueueRecord['status']): BuildTask['status'] => {
  return status as BuildTask['status'];
};

const buildTaskQueueTitle = (task: TaskQueueRecord): string | undefined => {
  const input = task.inputData as Record<string, unknown> | undefined;
  if (!input) return undefined;
  if (task.stage === "fetch") {
    const country = typeof input.countryName === "string"
      ? input.countryName
      : typeof input.countryCode === "string"
        ? input.countryCode
        : undefined;
    const adminLevel = typeof input.adminLevel === "number" ? `ADM` : undefined;
    return [country, adminLevel].filter(Boolean).join(" ");
  }
  if (task.stage === "transform") {
    const country = typeof input.countryName === "string"
      ? input.countryName
      : typeof input.countryCode === "string"
        ? input.countryCode
        : undefined;
    const adminLevel = typeof input.adminLevel === "number" ? `ADM` : undefined;
    const bandId = typeof input.bandId === "number" ? `band` : undefined;
    return [country, adminLevel, bandId].filter(Boolean).join(" ");
  }
  if (task.stage === "transform-by-zoom") {
    const bandId = typeof input.bandId === "number" ? `band` : undefined;
    const cacheId = typeof input.transformByBandCacheId === "string" ? input.transformByBandCacheId : undefined;
    return [bandId, cacheId].filter(Boolean).join(" ");
  }
  if (task.stage === "vt") {
    const bandId = typeof input.bandId === "number" ? `band` : undefined;
    const tileId = typeof input.tileId === "number" ? `tile:` : undefined;
    return [bandId, tileId].filter(Boolean).join(" ");
  }
  return undefined;
};

const mapTaskQueueRecordToBatchTask = (
  task: TaskQueueRecord,
  meta?: TaskWeightMeta,
): BuildTask & { title?: string; message?: string; metadata?: TaskWeightMetadata } => ({
  taskId: task.taskId,
  nodeId: task.nodeId,
  stage: mapTaskQueueStatusToStage(task.status),
  status: mapTaskQueueStatusToTaskStatus(task.status),
  type: task.stage,
  index: task.index,
  progress: resolveTaskProgress(task),
  retryCount: task.retryCount,
  error: task.errorMessage,
  message: task.message ?? task.errorMessage,
  title: buildTaskQueueTitle(task),
  metadata: meta
    ? {
      polygonCount: meta.polygonCount ?? undefined,
      weight: meta.weight,
      weightSource: meta.source,
    }
    : undefined,
});

type TaskWeightSource = 'output' | 'fetch-cache' | 'transform-cache' | 'fallback';

type TaskWeightMetadata = {
  polygonCount?: number;
  weight: number;
  weightSource: TaskWeightSource;
};

type TaskWeightMeta = {
  polygonCount?: number | null;
  weight: number;
  source: TaskWeightSource;
};

type TaskWeightContext = {
  fetchCacheById: Map<string, { polygonCount: number }>;
  fetchCacheBySourceKey: Map<string, { polygonCount: number }>;
  transformCacheById: Map<string, { polygonCount: number }>;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
};

const readNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
};

const readString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  return value;
};

const readStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
};

const resolveTaskType = (tasks: TaskQueueRecord[]): TaskQueueRecord['stage'] | undefined => {
  const stageOrder: Array<TaskQueueRecord['stage']> = ['fetch', 'transform', 'transform-by-zoom', 'vt'];
  return stageOrder.find((stage) => (
    tasks.some((task) => task.stage === stage && task.status !== 'completed' && task.status !== 'failed')
  ));
};

const summarizeTaskQueueStatus = (tasks: TaskQueueRecord[]) => {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.status === 'completed' && !isSkippedMessage(task.message)).length;
  const failed = tasks.filter((task) => task.status === 'failed').length;
  const skipped = tasks.filter((task) => isSkippedMessage(task.message)).length;
  const doneCount = Math.min(total, completed + skipped + failed);
  const status: BuildTask['status'] = failed > 0
    ? 'failed'
    : total > 0 && doneCount >= total
      ? 'completed'
      : total > 0
        ? 'running'
        : 'idle';
  return {
    status,
    taskType: resolveTaskType(tasks),
  };
};

const buildTaskWeightContext = async (
  nodeId: NodeId,
  tasks: TaskQueueRecord[],
): Promise<TaskWeightContext> => {
  const fetchCacheIds = new Set<string>();
  const fetchSourceKeys = new Set<string>();
  const transformBufferIds = new Set<string>();

  tasks.forEach((task) => {
    const input = asRecord(task.inputData);
    if (!input) return;
    if (task.stage === 'fetch') {
      const sourceKey = readString(input.sourceKey);
      if (sourceKey) fetchSourceKeys.add(sourceKey);
    }
    if (task.stage === 'transform') {
      const fetchCacheId = readString(input.fetchCacheId);
      if (fetchCacheId) fetchCacheIds.add(fetchCacheId);
      const sourceKey = readString(input.sourceKey);
      if (sourceKey) fetchSourceKeys.add(sourceKey);
    }
    if (task.stage === 'vt') {
      const bufferIds = readStringArray(input.bufferIds);
      bufferIds.forEach((id) => transformBufferIds.add(id));
    }
  });

  const shapeStore = new VtShapeDb();
  const fetchCaches = await listFetchCache(shapeStore, nodeId);
  const fetchCacheById = new Map(fetchCaches.map((cache) => [cache.id, cache] as const));
  const fetchCacheBySourceKey = new Map(fetchCaches.map((cache) => [cache.sourceKey, cache] as const));

  const bufferIds = [...transformBufferIds];
  const transformCaches = bufferIds.length > 0
    ? await ephemeralShapeDB.transformByBandCache.where('id').anyOf(bufferIds).toArray()
    : [];
  const transformCacheById = new Map(transformCaches.map((cache) => [cache.id, cache] as const));

  return {
    fetchCacheById,
    fetchCacheBySourceKey,
    transformCacheById,
  };
};

const resolveTaskWeightMeta = (
  task: TaskQueueRecord,
  context: TaskWeightContext,
): TaskWeightMeta => {
  const output = asRecord(task.outputData);
  const outputPolygonCount = readNumber(output?.polygonCount);
  if (outputPolygonCount !== null) {
    return { polygonCount: outputPolygonCount, weight: Math.max(0, Math.round(outputPolygonCount)), source: 'output' };
  }

  const input = asRecord(task.inputData) ?? {};
  if (task.stage === 'fetch') {
    const sourceKey = readString(input.sourceKey);
    const cache = sourceKey ? context.fetchCacheBySourceKey.get(sourceKey) : undefined;
    if (cache) {
      return { polygonCount: cache.polygonCount, weight: Math.max(0, Math.round(cache.polygonCount)), source: 'fetch-cache' };
    }
  }

  if (task.stage === 'transform') {
    const fetchCacheId = readString(input.fetchCacheId);
    const directCache = fetchCacheId ? context.fetchCacheById.get(fetchCacheId) : undefined;
    const sourceKey = readString(input.sourceKey);
    const sourceCache = sourceKey ? context.fetchCacheBySourceKey.get(sourceKey) : undefined;
    const cache = directCache ?? sourceCache;
    if (cache) {
      return { polygonCount: cache.polygonCount, weight: Math.max(0, Math.round(cache.polygonCount)), source: 'fetch-cache' };
    }
  }

  if (task.stage === 'vt') {
    const bufferIds = readStringArray(input.bufferIds);
    if (bufferIds.length > 0) {
      let polygonTotal = 0;
      let fallbackCount = 0;
      bufferIds.forEach((bufferId) => {
        const cache = context.transformCacheById.get(bufferId);
        const polygonCount = cache ? readNumber(cache.polygonCount) : null;
        if (polygonCount !== null) {
          polygonTotal += polygonCount;
        } else {
          fallbackCount += 1;
        }
      });
      const weight = Math.max(0, Math.round(polygonTotal + fallbackCount));
      const polygonCount = polygonTotal > 0 ? polygonTotal : null;
      const source: TaskWeightSource = polygonTotal > 0 ? 'transform-cache' : 'fallback';
      return { polygonCount, weight, source };
    }
  }

  return { polygonCount: null, weight: 1, source: 'fallback' };
};

const buildTaskWeightMap = async (
  nodeId: NodeId,
  tasks: TaskQueueRecord[],
): Promise<Map<string, TaskWeightMeta>> => {
  const context = await buildTaskWeightContext(nodeId, tasks);
  const map = new Map<string, TaskWeightMeta>();
  tasks.forEach((task) => {
    map.set(task.taskId, resolveTaskWeightMeta(task, context));
  });
  return map;
};

const summarizeTaskQueueProgress = async (
  tasks: TaskQueueRecord[],
  taskType?: TaskQueueRecord['stage'],
): Promise<ProgressInfo> => {
  let total = 0;
  let completed = 0;
  let failed = 0;
  let skipped = 0;
  tasks.forEach((task) => {
    total += 1;
    if (isSkippedMessage(task.message)) {
      skipped += 1;
      return;
    }
    if (task.status === 'failed') {
      failed += 1;
      return;
    }
    if (task.status === 'completed') {
      completed += 1;
    }
  });
  const doneCount = Math.min(total, completed + skipped + failed);
  const percentage = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  return {
    total,
    completed,
    failed,
    skipped,
    percentage,
    taskType,
  };
};

const buildTaskQueueSummary = async (tasks: TaskQueueRecord[]) => {
  const statusSummary = summarizeTaskQueueStatus(tasks);
  const progress = await summarizeTaskQueueProgress(tasks, statusSummary.taskType);
  return {
    status: statusSummary.status,
    progress,
  };
};

const buildProgressPayloadFromTasks = async (
  tasks: TaskQueueRecord[],
): Promise<BatchProgressPayload> => {
  const summary = await summarizeTaskQueueProgress(tasks, resolveTaskType(tasks));
  return {
    total: summary.total,
    completed: summary.completed,
    failed: summary.failed,
    skipped: summary.skipped,
  };
};

const getPauseState = (nodeId: NodeId): PauseState => {
  const key = String(nodeId);
  const existing = pauseStates.get(key);
  if (existing) return existing;
  const state: PauseState = { paused: false, waiters: [] };
  pauseStates.set(key, state);
  return state;
};

const waitIfPaused = async (nodeId: NodeId): Promise<void> => {
  const state = getPauseState(nodeId);
  if (!state.paused) return;
  await new Promise<void>((resolve) => {
    state.waiters.push(resolve);
  });
};

const setPaused = (nodeId: NodeId, paused: boolean): void => {
  const state = getPauseState(nodeId);
  state.paused = paused;
  if (!paused && state.waiters.length > 0) {
    const pending = [...state.waiters];
    state.waiters.length = 0;
    pending.forEach((resolve) => {resolve()});
  }
};

const resetRunningTasks = async (nodeId: NodeId): Promise<void> => {
  const taskQueue = new VtTaskQueueDb();
  const runningTasks = await listTasksByStatus(taskQueue, nodeId, 'running');
  await Promise.all(runningTasks.map((task) => updateTask(taskQueue, task.taskId, {
    status: 'queued',
    progress: 0,
    startedAt: undefined,
    completedAt: undefined,
    errorMessage: undefined,
  })));
};

const resolveProgressPhase = (nodeId: NodeId, tasks: TaskQueueRecord[]): BatchProgressEvent['phase'] => {
  if (getPauseState(nodeId).paused) return 'paused';
  const status = summarizeTaskQueueStatus(tasks).status;
  switch (status) {
    case 'running':
      return 'running';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    default:
      return 'queued';
  }
};

const emitProgressSnapshot = async (
  nodeId: NodeId,
  message?: string,
): Promise<void> => {
  const sub = progressCallbacks.get(String(nodeId));
  if (!sub?.callback) return;
  try {
    const taskQueue = new VtTaskQueueDb();
    const vtTasks = await listTasks(taskQueue, nodeId);
    const phase = resolveProgressPhase(nodeId, vtTasks);
    const statusSummary = summarizeTaskQueueStatus(vtTasks);
    const payload = await buildProgressPayloadFromTasks(vtTasks);
    sub.callback({
      nodeId,
      stage: statusSummary.taskType ?? 'fetch',
      phase,
      timestamp: Date.now(),
      message,
      payload,
    });
  } catch (error) {
    console.error('[shapeBatchAPI] progress snapshot build failed', error);
  }
};


export const shapeBatchAPI = {

  // ===================================
  // Data Source Operations
  // ===================================

  getDataSourceConfigs: async (): Promise<DataSourceConfig[]> => {
    return SHAPE_DATA_SOURCES;
  },

  getCountryMetadata: async (nodeId: NodeId, dataSource: DataSourceName): Promise<CountryMetadata[]> => {
    if (dataSource === 'openstreetmap') {
      throw new Error('OpenStreetMap is not supported in Step3 country selection.');
    }
    const data = await metadataLoader.loadMetadata(dataSource, nodeId);
    if (Array.isArray(data) && data.length > 0) return data;
    throw new Error(`No country metadata returned for data source: ${dataSource}`);
  },

  generateDownloadTaskPayloads: async (
    nodeId: NodeId,
    dataSource: DataSourceName,
    countries: string[],
    adminLevels: number[],
  ): Promise<FetchTaskPayload[]> => {
    const resolvedDataSource = requireDataSourceName(dataSource, 'generateDownloadTaskPayloads');
    // Get country metadata first
    const preferredFormat = getPreferredCountryCodeFormat(resolvedDataSource);
    const normalizedCountries = await Promise.all(
      countries.map((code) => normalizeCountryCodeFormat(code, preferredFormat)),
    );
    const countryMetadata = await shapeBatchAPI.getCountryMetadata(nodeId, resolvedDataSource);
    return generateDownloadTaskPayloads(resolvedDataSource, normalizedCountries, adminLevels, countryMetadata);
  },

  generateDownloadTaskPayloadsFromSelection: async (
    nodeId: NodeId,
    dataSource: DataSourceName,
    selectedArrayByCountries: SelectedArrayByCountries,
  ): Promise<FetchTaskPayload[]> => {
    const resolvedDataSource = requireDataSourceName(dataSource, 'generateDownloadTaskPayloadsFromSelection');
    const countryMetadata = await shapeBatchAPI.getCountryMetadata(nodeId, resolvedDataSource);
    const strategy = resolveFetchStageStrategy(resolvedDataSource);
    return strategy.buildFetchTaskPayloads({
      selectedArrayByCountries,
      countryMetadata,
    });
  },

  // ===================================
  // Selection Validation
  // ===================================

  validateSelection: async (
    countries: string[],
    adminLevels: number[],
    dataSource: DataSourceName,
  ): Promise<ShapeStepValidationResult> => {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!isDataSourceName(dataSource)) {
      errors.push('Invalid data source selected');
    }
    if (countries.length === 0) {
      errors.push('At least one country must be selected');
    }

    if (adminLevels.length === 0) {
      errors.push('At least one administrative level must be selected');
    }

    if (countries.length > 10) {
      warnings.push('Large country selection may require significant processing time');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },

  // ===================================
  // DraftTypes-based Batch Processing
  // ===================================

  startBatchProcess: async (
    draftId: NodeId,
    buildConfig: ShapeBuildConfig,
    downloadTaskPayloads: FetchTaskPayload[],
    progressCallback?: (event: BatchProgressEvent) => void,
  ): Promise<NodeId> => {
    if (!buildConfig.dataSourceName) {
      throw new Error('Data source is required to start batch processing');
    }
    // Prefer persisted draft config when provided to avoid stale zoom settings.
    const handler = getShapeEntityHandler();
    const draftLike = await handler.getEntity(draftId) as DraftLike;
    const draftBuildConfig = draftLike?.draftData?.buildConfig;
    const mergedBatchConfig = draftBuildConfig
      ? mergeBuildConfig(draftBuildConfig, buildConfig)
      : buildConfig;
    const validation = validateBatchConfig(mergedBatchConfig);
    if (!validation.isValid) {
      throw new Error(`Invalid processing config: ${validation.errors?.join(', ')}`);
    }

    // Get draft to find the associated nodeId
    if (!draftLike) {
      throw new Error(`Working copy not found: ${draftId}`);
    }

    if (!downloadTaskPayloads.length && !draftLike?.draftData?.selectedArrayByCountries) {
      throw new Error('Shape batch session requires download task payloads or selection');
    }

    const nodeForSession = draftLike.nodeId ?? draftLike.treeNodeId ?? draftId;
    const buildStartedAt = Date.now();
    await handler.updateEntity(nodeForSession, {
      buildStartedAt,
      buildFinishedAt: undefined,
      processingStatus: 'processing',
    });

    const pipelineKey = String(nodeForSession);
    activePipelines.add(pipelineKey);
    void runShapeVtPipeline({
      nodeId: nodeForSession,
      dataSource: mergedBatchConfig.dataSourceName,
      buildConfig: mergedBatchConfig,
      selectedArrayByCountries: draftLike?.draftData?.selectedArrayByCountries,
      downloadTaskPayloads,
      waitIfPaused: () => waitIfPaused(nodeForSession),
    }).then(async () => {
      await handler.updateEntity(nodeForSession, {
        buildFinishedAt: Date.now(),
        processingStatus: 'completed',
      });
    }).catch(async (error) => {
      console.error('[shapeBatchAPI] vt pipeline failed', error);
      await handler.updateEntity(nodeForSession, {
        processingStatus: 'failed',
      });
    }).finally(() => {
      activePipelines.delete(pipelineKey);
      pauseStates.delete(String(nodeForSession));
    });

    if (progressCallback) {
      const existing = progressCallbacks.get(String(nodeForSession));
      existing?.unsubscribe?.();
      const taskQueue = new VtTaskQueueDb();
      const unsubscribe = onTaskQueueUpdate(nodeForSession, (event) => {
        void (async () => {
          try {
            const vtTasks = await listTasks(taskQueue, event.nodeId);
            progressCallback({
              nodeId: event.nodeId,
              stage: event.task.stage,
              phase: resolveProgressPhase(event.nodeId, vtTasks),
              timestamp: Date.now(),
              message: event.task.message,
              payload: await buildProgressPayloadFromTasks(vtTasks),
            });
          } catch (error) {
            console.error('[shapeBatchAPI] progress payload build failed', error);
          }
        })();
      });
      progressCallbacks.set(String(nodeForSession), { unsubscribe, callback: progressCallback });
    }

    return nodeForSession;
  },

  invokeBatchCommand: async (command: string, payload: Record<string, unknown>): Promise<void> => {
    if (command === 'session/pause') {
      const nodeId = payload.nodeId as NodeId;
      if (!nodeId) throw new Error('[shapeBatchAPI] session/pause requires nodeId');
      setPaused(nodeId, true);
      await emitProgressSnapshot(nodeId);
      return;
    }
    if (command === 'session/resume') {
      const nodeId = payload.nodeId as NodeId;
      if (!nodeId) throw new Error('[shapeBatchAPI] session/resume requires nodeId');
      setPaused(nodeId, false);
      await emitProgressSnapshot(nodeId);
      const pipelineKey = String(nodeId);
      const taskQueue = new VtTaskQueueDb();
      const runningTasks = await listTasksByStatus(taskQueue, nodeId, 'running');
      if (runningTasks.length > 0) {
        await resetRunningTasks(nodeId);
        if (activePipelines.has(pipelineKey)) {
          activePipelines.delete(pipelineKey);
        }
      }
      if (!activePipelines.has(pipelineKey)) {
        const handler = getShapeEntityHandler();
        const draftLike = await handler.getEntity(nodeId) as DraftLike | null;
        if (!draftLike) return;
        const draftBuildConfig = draftLike?.draftData?.buildConfig;
        const entityBuildConfig = (draftLike as { buildConfig?: ShapeBuildConfig }).buildConfig;
        const baseBuildConfig = draftBuildConfig ?? entityBuildConfig;
        if (!baseBuildConfig) {
          throw new Error('[shapeBatchAPI] buildConfig is required to resume batch session');
        }
        const mergedBuildConfig = entityBuildConfig
          ? mergeBuildConfig(baseBuildConfig, entityBuildConfig)
          : baseBuildConfig;
        const resolvedDataSource = requireDataSourceName(
          mergedBuildConfig.dataSourceName,
          'resumeBatchSession',
        );
        activePipelines.add(pipelineKey);
        void runShapeVtPipeline({
          nodeId,
          dataSource: resolvedDataSource,
          buildConfig: mergedBuildConfig,
          selectedArrayByCountries: draftLike?.draftData?.selectedArrayByCountries,
          waitIfPaused: () => waitIfPaused(nodeId),
          resumeExistingTasks: true,
        }).then(async () => {
          await handler.updateEntity(nodeId, {
            buildFinishedAt: Date.now(),
            processingStatus: 'completed',
          });
        }).catch(async (error) => {
          console.error('[shapeBatchAPI] vt pipeline failed', error);
          await handler.updateEntity(nodeId, {
            processingStatus: 'failed',
          });
        }).finally(() => {
          activePipelines.delete(pipelineKey);
          pauseStates.delete(pipelineKey);
        });
      }
      return;
    }
    throw new Error(`[shapeBatchAPI] Unknown batch command: ${command}`);
  },

  getBuildSession: async (nodeId: NodeId): Promise<BatchSession | undefined> => {
    const taskQueue = new VtTaskQueueDb();
    const vtTasks = await listTasks(taskQueue, nodeId);
    if (vtTasks.length > 0) {
      const handler = getShapeEntityHandler();
      const entity = await handler.getEntity(nodeId);
      if (!entity?.buildConfig) {
        throw new Error('[shapeBatchAPI] buildConfig is required for build session');
      }
      const config = buildBuildSessionConfig(entity.buildConfig);
      const summary = await buildTaskQueueSummary(vtTasks);
      const paused = getPauseState(nodeId).paused;
      const startedAt = Math.min(...vtTasks.map((task) => task.createdAt ?? Date.now()));
      return {
        draftId: nodeId,
        nodeId,
        status: paused ? 'paused' : summary.status,
        config,
        startedAt,
        updatedAt: Date.now(),
        completedAt: summary.status === 'completed' ? Date.now() : undefined,
        progress: summary.progress,
        canResume: paused,
        lastActivity: Date.now(),
        expiresAt: Date.now(),
        stages: {},
        resourceUsage: undefined,
      };
    }
    return undefined;
  },

  getBatchTasks: async (nodeId: NodeId): Promise<BuildTask[]> => {
    const taskQueue = new VtTaskQueueDb();
    const vtTasks = await listTasks(taskQueue, nodeId);
    if (vtTasks.length > 0) {
      const weightMap = await buildTaskWeightMap(nodeId, vtTasks);
      return vtTasks.map((task) => mapTaskQueueRecordToBatchTask(task, weightMap.get(task.taskId)));
    }
    return [];
  },

  getBatchProgress: async (draftId: NodeId): Promise<ProgressInfo> => {
    const handler = getShapeEntityHandler();
    const entity = await handler.getEntity(draftId);
    const nodeId = resolveBatchNodeId(entity as DraftLike | undefined);
    if (!entity || !nodeId) {
      return {
        total: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 0,
      };
    }
    const taskQueue = new VtTaskQueueDb();
    const vtTasks = await listTasks(taskQueue, nodeId);
    if (vtTasks.length > 0) {
      const summary = await buildTaskQueueSummary(vtTasks);
      return summary.progress;
    }
    return {
      total: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      percentage: 0,
    };
  },

  getBatchStatus: async (
    nodeId: NodeId,
  ): Promise<{
    nodeId: NodeId;
    draftId?: NodeId;
    status: string;
    progress?: number;
    completedTasks?: number;
    totalTasks?: number;
  }> => {
    const taskQueue = new VtTaskQueueDb();
    const vtTasks = await listTasks(taskQueue, nodeId);
    if (vtTasks.length > 0) {
      const summary = await buildTaskQueueSummary(vtTasks);
      const paused = getPauseState(nodeId).paused;
      return {
        nodeId,
        status: paused ? 'paused' : summary.status,
        progress: summary.progress.percentage,
        completedTasks: summary.progress.completed,
        totalTasks: summary.progress.total,
      };
    }
    return {
      nodeId,
      status: 'idle',
    };
  },

  // ===================================
  // Batch Session Recovery
  // ===================================

  findPendingBatchSessions: async (nodeId: NodeId): Promise<BatchSession[]> => {
    console.log(`Finding pending batch sessions for node: ${nodeId}`);
    return [];
  },

  getBuildSessionStatus: async (
    nodeId: NodeId,
  ): Promise<{
    exists: boolean;
    canResume: boolean;
    lastActivity: number;
    expiresAt: number;
  }> => {
    const taskQueue = new VtTaskQueueDb();
    const vtTasks = await listTasks(taskQueue, nodeId);
    if (vtTasks.length > 0) {
      const lastActivity = vtTasks.reduce((latest, task) => {
        const candidate = task.updatedAt ?? task.startedAt ?? task.createdAt ?? 0;
        return candidate > latest ? candidate : latest;
      }, 0);
      const paused = getPauseState(nodeId).paused;
      return {
        exists: true,
        canResume: paused,
        lastActivity,
        expiresAt: lastActivity + 5 * 60 * 1000,
      };
    }
    return {
      exists: false,
      canResume: false,
      lastActivity: 0,
      expiresAt: 0,
    };
  },

  // ===================================
  // Cleanup (mock/no-op placeholder)
  // ===================================

  performCleanup: async (): Promise<{
    workingCopiesRemoved: number;
    buildSessionsRemoved: number;
    totalSpaceRecovered: number;
    timestamp: number;
  }> => {
    console.log('Performing draft cleanup (mock)');
    return {
      workingCopiesRemoved: 0,
      buildSessionsRemoved: 0,
      totalSpaceRecovered: 0,
      timestamp: Date.now(),
    };
  },

  getCleanupStats: async (): Promise<{
    totalDrafts: number;
    expiredDrafts: number;
    totalBuildSessions: number;
    expiredBuildSessions: number;
    estimatedSpaceUsed: number;
    lastCleanupAt?: number;
  }> => {
    console.log('Getting cleanup statistics (mock)');
    return {
      totalDrafts: 0,
      expiredDrafts: 0,
      totalBuildSessions: 0,
      expiredBuildSessions: 0,
      estimatedSpaceUsed: 0,
      lastCleanupAt: Date.now(),
    };
  },

  // ===================================
  // Real-time Progress Subscription
  // ===================================

  subscribeToProgress: (nodeId: NodeId, callback: (event: BatchProgressEvent) => void): (() => void) => {
    const existing = progressCallbacks.get(String(nodeId));
    existing?.unsubscribe?.();
    const taskQueue = new VtTaskQueueDb();
    const unsubscribeTaskQueue = onTaskQueueUpdate(nodeId, (event) => {
      void (async () => {
        try {
          const vtTasks = await listTasks(taskQueue, event.nodeId);
          callback({
            nodeId: event.nodeId,
            stage: event.task.stage,
            phase: resolveProgressPhase(event.nodeId, vtTasks),
            timestamp: Date.now(),
            message: event.task.message,
            payload: await buildProgressPayloadFromTasks(vtTasks),
          });
        } catch (error) {
          console.error('[shapeBatchAPI] progress payload build failed', error);
        }
      })();
    });
    const unsubscribe = () => {
      unsubscribeTaskQueue();
    };
    progressCallbacks.set(String(nodeId), { unsubscribe, callback });

    return () => {
      const active = progressCallbacks.get(String(nodeId));
      active?.unsubscribe?.();
      progressCallbacks.delete(String(nodeId));
    };
  },

  // removed duplicate older getProcessingStatus (migrated to unified shape below)

  forceCleanup: async (): Promise<{
    workingCopiesRemoved: number;
    buildSessionsRemoved: number;
    totalSpaceRecovered: number;
    timestamp: number;
  }> => {
    console.log('Force cleaning all transient data (mock)');
    return {
      workingCopiesRemoved: 0,
      buildSessionsRemoved: 0,
      totalSpaceRecovered: 0,
      timestamp: Date.now(),
    };
  },

  // ===================================
  // Feature Data Access
  // ===================================

  getProcessedFeatureCount: async (nodeId: NodeId): Promise<number> => {
    return shapeQueryAPIImpl.getProcessedFeatureCount(nodeId);
  },

  getVectorTileInfo: async (
    nodeId: NodeId,
    z: number,
    x: number,
    y: number,
  ): Promise<TileInfo | undefined> => {
    const tile = await shapeQueryAPIImpl.getVectorTileInfo(nodeId, z, x, y);
    if (!tile) return undefined;
    return {
      exists: true,
      size: tile.size,
      features: tile.features,
      layers: (tile.layers ?? []).map((layer) => layer.name),
      generatedAt: tile.generatedAt,
      lastAccessed: tile.lastAccessed,
    };
  },

  // ===================================
  // Status and Monitoring
  // ===================================

  getProcessingStatus: async (nodeId: NodeId): Promise<ProcessingStatus> => {
    const handler = getShapeEntityHandler();
    const entity = await handler.getEntity(nodeId);
    if (!entity) return { status: 'idle', hasErrors: false, errorMessages: [] };

    const taskQueue = new VtTaskQueueDb();
    const vtTasks = await listTasks(taskQueue, nodeId);
    if (vtTasks.length > 0) {
      const summary = await buildTaskQueueSummary(vtTasks);
      const paused = getPauseState(nodeId).paused;
      const lastProcessed = vtTasks.reduce((latest, task) => {
        const candidate = task.completedAt ?? task.updatedAt ?? task.startedAt ?? task.createdAt ?? 0;
        return candidate > latest ? candidate : latest;
      }, 0);
      return {
        status: paused
          ? 'paused'
          : summary.status === 'running'
          ? 'processing'
          : summary.status === 'completed'
            ? 'completed'
            : summary.status === 'failed'
              ? 'failed'
              : 'idle',
        lastProcessed: lastProcessed || undefined,
        hasErrors: summary.status === 'failed',
        errorMessages: summary.status === 'failed' ? ['Batch processing failed'] : [],
        totalFeatures: undefined,
        totalVectorTiles: undefined,
        storageUsed: undefined,
      };
    }

    return {
      status: entity.processingStatus || 'idle',
      lastProcessed: undefined,
      totalFeatures: undefined,
      totalVectorTiles: undefined,
      storageUsed: undefined,
      hasErrors: false,
      errorMessages: [],
    };
  },

  cleanupProcessingData: async (nodeId: NodeId): Promise<void> => {
    await shapeMutationAPIImpl.cleanupProcessingData(nodeId);
    try {
      const store = createShapeChunkStore(bufferSerializer, bufferDeserializer);
      await store.deleteAllForNode(nodeId);
    } catch (error) {
      console.warn('[shapeBatchAPI] failed to clean chunk-store relations', error);
    }
  },
};

function requireDataSourceName(value: unknown, context: string): DataSourceName {
  if (typeof value !== 'string') {
    throw new Error(`[shape-plugin] ${context} requires a data source name.`);
  }
  if (isDataSourceName(value)) return value;
  throw new Error(`[shape-plugin] ${context} received invalid data source: ${value}`);
}

function isDataSourceName(value: string): value is DataSourceName {
  return value === 'naturalearth' ||
    value === 'geoboundaries' ||
    value === 'gadm' ||
    value === 'openstreetmap';
}
