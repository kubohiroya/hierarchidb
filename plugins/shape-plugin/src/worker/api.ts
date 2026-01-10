/**
 * Worker API implementation for Shape plugin
 * Exposes batch-oriented operations for runtime worker adapters
 */

import { toNodeId, type NodeId } from '@hierarchidb/common-types';
import {
  type BatchSession,
  type BatchTask,
  type CountryMetadata,
  type DataSourceConfig,
  type DataSourceName,
  SHAPE_DATA_SOURCES,
  DEFAULT_PROCESSING_CONFIG,
  mergeBatchConfig,
  type BatchConfig,
  type BatchSessionConfig,
  type ProcessingStatus,
  type ProgressInfo,
  type TileInfo,
  type DownloadTaskPayload,
  validateBatchConfig,
  type ShapeStepValidationResult,
  BatchTaskStage,
  type BatchTaskStageType,
} from '../common/types/index.js';
import { ShapeEntityHandler } from './handlers/index.js';

import { metadataLoader } from '../services/metadata/MetadataLoader.js';
import { getShapeDbApiClient } from '../services/batch/ShapeBatchApiClient.js';
import type { BatchProgressEvent, BatchProgressPayload } from '@hierarchidb/common-api';
import {
  generateDownloadTaskPayloads,
  getPreferredCountryCodeFormat,
} from '../services/utils/utils.js';
import { bufferDeserializer, bufferSerializer, createShapeChunkStore } from '../services/utils/chunkStore.js';
import { normalizeCountryCodeFormat } from '../services/utils/iso3166.js';
import { resolveDownloadStageStrategy } from '../services/batch/strategies/resolveDownloadStageStrategy.js';
import type { SelectedArrayByCountries, ShapeEntity } from '../common/types/ShapeEntity.ts';
import {
  VtTaskQueueDb,
  listTasks,
  onTaskQueueUpdate,
  type TaskQueueRecord,
} from '@hierarchidb/vt-orchestrator';
import { runShapeVtPipeline } from '../services/vt/shapeVtPipeline.js';

type DraftLike = {
  nodeId?: NodeId;
  treeNodeId?: NodeId;
  draftData?: Partial<ShapeEntity>;
};

const resolveBatchNodeId = (draft: DraftLike | null | undefined): NodeId | undefined => {
  const resolved = draft?.nodeId ?? draft?.treeNodeId ?? draft?.draftData?.nodeId;
  return resolved ? toNodeId(String(resolved)) : undefined;
};

const buildBatchSessionConfig = (batchConfig: BatchConfig, draft?: DraftLike): BatchSessionConfig => {
  const downloadConfig = batchConfig.downloadConfig ?? DEFAULT_PROCESSING_CONFIG.downloadConfig;
  const legacyExtraction = batchConfig.extractionConfig;
  const extract1Config = batchConfig.extract1Config ?? (legacyExtraction ? {
    workers: legacyExtraction.level1Workers,
    tolerance: legacyExtraction.tolerance,
    featureFilterMethod: legacyExtraction.featureFilterMethod,
    areaThreshold: legacyExtraction.areaThreshold,
    minVertexCountForAreaFilter: legacyExtraction.minVertexCountForAreaFilter,
    aspectRatioThreshold: legacyExtraction.aspectRatioThreshold,
    hybridFilterConfig: legacyExtraction.hybridFilterConfig,
  } : undefined) ?? DEFAULT_PROCESSING_CONFIG.extract1Config;
  const extract2Config = batchConfig.extract2Config ?? (legacyExtraction ? {
    workers: legacyExtraction.level2Workers,
    tolerance: legacyExtraction.tolerance,
    quantize: legacyExtraction.quantize,
    enablePerFeatureExtraction: legacyExtraction.enablePerFeatureExtraction,
  } : undefined) ?? DEFAULT_PROCESSING_CONFIG.extract2Config;
  const tileConfig = batchConfig.tileConfig ?? DEFAULT_PROCESSING_CONFIG.tileConfig;
  const cleanupConfig = batchConfig.cleanupConfig ?? DEFAULT_PROCESSING_CONFIG.cleanupConfig;
  const resolvedDataSource = requireDataSourceName(
    batchConfig.dataSource
    ?? draft?.draftData?.batchConfig?.dataSource,
    'buildBatchSessionConfig',
  );

  return {
    dataSource: resolvedDataSource,
    download: {
      concurrentDownloads: downloadConfig?.maxConcurrent ?? 4,
      deleteOnComplete: cleanupConfig?.deleteDownloadedFiles ?? false,
      timeoutMs: downloadConfig?.timeoutMs,
      retryAttempts: downloadConfig?.retryAttempts ?? 3,
      retryDelay: downloadConfig?.retryDelay,
    },
    extract1: {
      concurrentProcesses: extract1Config?.workers ?? 2,
      enableFeatureFiltering: true,
      featureAreaThreshold: extract1Config?.areaThreshold ?? 0.5,
      minVertexCountForAreaFilter: extract1Config?.minVertexCountForAreaFilter ?? 25,
      aspectRatioThreshold: extract1Config?.aspectRatioThreshold ?? 5,
      featureFilterMethod: extract1Config?.featureFilterMethod ?? 'hybrid',
      hybridFilterConfig:
        extract1Config?.hybridFilterConfig
        ?? DEFAULT_PROCESSING_CONFIG.extract1Config?.hybridFilterConfig,
      deleteOnComplete: false,
    },
    extract2: {
      concurrentProcesses: extract2Config?.workers ?? 2,
      enablePerFeatureExtraction: extract2Config?.enablePerFeatureExtraction ?? true,
      extractionMode: extract2Config?.extractionMode ?? DEFAULT_PROCESSING_CONFIG.extract2Config?.extractionMode,
      deleteOnComplete: false,
      quantize: extract2Config?.quantize ?? 0,
      extract: extract2Config?.tolerance ?? 0,
      tolerance: extract2Config?.tolerance ?? 0,
    },
    vectorTiles: {
      concurrentProcesses: tileConfig?.workers ?? 4,
      bufferSize: tileConfig?.bufferSize,
      tileSize: tileConfig?.tileSize,
      tileExpandFactor: tileConfig?.tileExpandFactor,
      tileExpandMargin: tileConfig?.tileExpandMargin,
    },
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

const shapeEntityHandlerSingleton = new ShapeEntityHandler();
const getShapeEntityHandler = (): ShapeEntityHandler => shapeEntityHandlerSingleton;

const isSkippedMessage = (message?: string | null): boolean => {
  if (!message) return false;
  const normalized = message.trim().toLowerCase();
  return normalized === 'skipped' || normalized.startsWith('skipped:');
};

const mapTaskQueueStatusToStage = (status: TaskQueueRecord['status']): BatchTaskStageType => {
  switch (status) {
    case 'queued':
      return BatchTaskStage.WAIT;
    case 'running':
      return BatchTaskStage.PROCESS;
    case 'completed':
      return BatchTaskStage.SUCCESS;
    case 'failed':
    default:
      return BatchTaskStage.ERROR;
  }
};

const mapTaskQueueStatusToTaskStatus = (status: TaskQueueRecord['status']): BatchTask['status'] => {
  return status as BatchTask['status'];
};

const buildTaskQueueTitle = (task: TaskQueueRecord): string | undefined => {
  const input = task.inputData as Record<string, unknown> | undefined;
  if (!input) return undefined;
  if (task.stage === 'fetch') {
    const country = typeof input.countryName === 'string'
      ? input.countryName
      : typeof input.countryCode === 'string'
        ? input.countryCode
        : undefined;
    const adminLevel = typeof input.adminLevel === 'number' ? `ADM${input.adminLevel}` : undefined;
    return [country, adminLevel].filter(Boolean).join(' ');
  }
  if (task.stage === 'transform') {
    const country = typeof input.countryName === 'string'
      ? input.countryName
      : typeof input.countryCode === 'string'
        ? input.countryCode
        : undefined;
    const adminLevel = typeof input.adminLevel === 'number' ? `ADM${input.adminLevel}` : undefined;
    const bandId = typeof input.bandId === 'number' ? `band${input.bandId}` : undefined;
    return [country, adminLevel, bandId].filter(Boolean).join(' ');
  }
  if (task.stage === 'vt') {
    const bandId = typeof input.bandId === 'number' ? `band${input.bandId}` : undefined;
    const tileId = typeof input.tileId === 'number' ? `tile:${input.tileId}` : undefined;
    return [bandId, tileId].filter(Boolean).join(' ');
  }
  return undefined;
};

const mapTaskQueueRecordToBatchTask = (
  task: TaskQueueRecord,
): BatchTask & { title?: string; message?: string } => ({
  taskId: task.taskId,
  taskType: task.stage,
  nodeId: task.nodeId,
  stage: mapTaskQueueStatusToStage(task.status),
  status: mapTaskQueueStatusToTaskStatus(task.status),
  type: task.stage,
  index: task.index,
  progress: task.progress,
  retryCount: task.retryCount,
  error: task.errorMessage,
  message: task.message ?? task.errorMessage,
  title: buildTaskQueueTitle(task),
});

const summarizeTaskQueue = (tasks: TaskQueueRecord[]) => {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.status === 'completed' && !isSkippedMessage(task.message)).length;
  const failed = tasks.filter((task) => task.status === 'failed').length;
  const skipped = tasks.filter((task) => isSkippedMessage(task.message)).length;
  const stageOrder: Array<TaskQueueRecord['stage']> = ['fetch', 'transform', 'vt'];
  const taskType = stageOrder.find((stage) => (
    tasks.some((task) => task.stage === stage && task.status !== 'completed' && task.status !== 'failed')
  ));
  const doneCount = Math.min(total, completed + skipped + failed);
  const percentage = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const status: BatchSession['status'] = failed > 0
    ? 'failed'
    : total > 0 && doneCount >= total
      ? 'completed'
      : total > 0
        ? 'running'
        : 'idle';
  return {
    status,
    progress: {
      total,
      completed,
      failed,
      skipped,
      percentage,
      taskType,
    },
  };
};

const buildProgressPayloadFromTasks = (tasks: TaskQueueRecord[]): BatchProgressPayload => {
  const summary = summarizeTaskQueue(tasks).progress;
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
    pending.forEach((resolve) => resolve());
  }
};

const resolveProgressPhase = (nodeId: NodeId, tasks: TaskQueueRecord[]): BatchProgressEvent['phase'] => {
  if (getPauseState(nodeId).paused) return 'paused';
  const status = summarizeTaskQueue(tasks).status;
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
    sub.callback({
      nodeId,
      stage: summarizeTaskQueue(vtTasks).progress.taskType ?? 'fetch',
      phase,
      timestamp: Date.now(),
      message,
      payload: buildProgressPayloadFromTasks(vtTasks),
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
  ): Promise<DownloadTaskPayload[]> => {
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
  ): Promise<DownloadTaskPayload[]> => {
    const resolvedDataSource = requireDataSourceName(dataSource, 'generateDownloadTaskPayloadsFromSelection');
    const countryMetadata = await shapeBatchAPI.getCountryMetadata(nodeId, resolvedDataSource);
    const strategy = resolveDownloadStageStrategy(resolvedDataSource);
    return strategy.buildDownloadTaskPayloads({
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
    batchConfig: BatchConfig,
    downloadTaskPayloads: DownloadTaskPayload[],
    progressCallback?: (event: BatchProgressEvent) => void,
  ): Promise<NodeId> => {
    if (!batchConfig?.dataSource) {
      throw new Error('Data source is required to start batch processing');
    }
    // Prefer persisted draft config when provided to avoid stale zoom settings.
    const handler = getShapeEntityHandler();
    const draftLike = await handler.getEntity(draftId) as DraftLike;
    const mergedBatchConfig = mergeBatchConfig({
      ...(draftLike?.draftData?.batchConfig ?? {}),
      ...batchConfig,
    });
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

    void runShapeVtPipeline({
      nodeId: nodeForSession,
      dataSource: mergedBatchConfig.dataSource as DataSourceName,
      batchConfig: mergedBatchConfig,
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
              payload: buildProgressPayloadFromTasks(vtTasks),
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
      return;
    }
    throw new Error(`[shapeBatchAPI] Unknown batch command: ${command}`);
  },

  getBatchSession: async (nodeId: NodeId): Promise<BatchSession | undefined> => {
    const taskQueue = new VtTaskQueueDb();
    const vtTasks = await listTasks(taskQueue, nodeId);
    if (vtTasks.length > 0) {
      const handler = getShapeEntityHandler();
      const entity = await handler.getEntity(nodeId);
      const mergedConfig = mergeBatchConfig(entity?.batchConfig ?? DEFAULT_PROCESSING_CONFIG);
      const config = buildBatchSessionConfig(mergedConfig, { draftData: entity ?? undefined });
      const summary = summarizeTaskQueue(vtTasks);
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

  getBatchTasks: async (nodeId: NodeId): Promise<BatchTask[]> => {
    const taskQueue = new VtTaskQueueDb();
    const vtTasks = await listTasks(taskQueue, nodeId);
    if (vtTasks.length > 0) {
      return vtTasks.map(mapTaskQueueRecordToBatchTask);
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
      return summarizeTaskQueue(vtTasks).progress;
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
      const summary = summarizeTaskQueue(vtTasks);
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

  getBatchSessionStatus: async (
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
    batchSessionsRemoved: number;
    totalSpaceRecovered: number;
    timestamp: number;
  }> => {
    console.log('Performing draft cleanup (mock)');
    return {
      workingCopiesRemoved: 0,
      batchSessionsRemoved: 0,
      totalSpaceRecovered: 0,
      timestamp: Date.now(),
    };
  },

  getCleanupStats: async (): Promise<{
    totalDrafts: number;
    expiredDrafts: number;
    totalBatchSessions: number;
    expiredBatchSessions: number;
    estimatedSpaceUsed: number;
    lastCleanupAt?: number;
  }> => {
    console.log('Getting cleanup statistics (mock)');
    return {
      totalDrafts: 0,
      expiredDrafts: 0,
      totalBatchSessions: 0,
      expiredBatchSessions: 0,
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
            payload: buildProgressPayloadFromTasks(vtTasks),
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
    batchSessionsRemoved: number;
    totalSpaceRecovered: number;
    timestamp: number;
  }> => {
    console.log('Force cleaning all transient data (mock)');
    return {
      workingCopiesRemoved: 0,
      batchSessionsRemoved: 0,
      totalSpaceRecovered: 0,
      timestamp: Date.now(),
    };
  },

  // ===================================
  // Feature Data Access
  // ===================================

  getProcessedFeatureCount: async (nodeId: NodeId): Promise<number> => {
    return getShapeDbApiClient().query.getProcessedFeatureCount(nodeId);
  },

  getVectorTileInfo: async (
    nodeId: NodeId,
    z: number,
    x: number,
    y: number,
  ): Promise<TileInfo | undefined> => {
    const tile = await getShapeDbApiClient().query.getVectorTileInfo(nodeId, z, x, y);
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
      const summary = summarizeTaskQueue(vtTasks);
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
    await getShapeDbApiClient().mutation.cleanupProcessingData(nodeId);
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
