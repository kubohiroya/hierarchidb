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
import type { BatchProgressEvent } from '@hierarchidb/common-api';
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
      minZoom: tileConfig?.minZoom ?? 0,
      maxZoom: tileConfig?.maxZoom ?? (tileConfig?.minZoom ?? 0),
      bufferSize: tileConfig?.bufferSize,
      tileSize: tileConfig?.tileSize,
      zoomBreakpoints: tileConfig?.zoomBreakpoints,
      tileExpandFactor: tileConfig?.tileExpandFactor,
      tileExpandMargin: tileConfig?.tileExpandMargin,
    },
  };
};

interface ProgressSubscription {
  unsubscribe?: () => void;
}

const progressCallbacks = new Map<string, ProgressSubscription>();

const shapeEntityHandlerSingleton = new ShapeEntityHandler();
const getShapeEntityHandler = (): ShapeEntityHandler => shapeEntityHandlerSingleton;

const isSkippedMessage = (message?: string | null): boolean => {
  if (!message) return false;
  const normalized = message.trim().toLowerCase();
  return normalized === 'skipped' || normalized.startsWith('skipped:');
};

const mapTaskQueueStatusToStage = (status: TaskQueueRecord['status']): BatchTaskStageType => {
  switch (status) {
    case 'waiting':
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

const mapTaskQueueStatusToPhase = (status: TaskQueueRecord['status']): BatchProgressEvent['phase'] => {
  if (status === 'waiting') return 'queued';
  return status as BatchProgressEvent['phase'];
};

const buildTaskQueueTitle = (task: TaskQueueRecord): string | undefined => {
  const input = task.inputData as Record<string, unknown> | undefined;
  if (!input) return undefined;
  if (task.stage === 'fetch') {
    const country = typeof input.countryCode === 'string' ? input.countryCode : undefined;
    const adminLevel = typeof input.adminLevel === 'number' ? `ADM${input.adminLevel}` : undefined;
    return [country, adminLevel].filter(Boolean).join(' ');
  }
  if (task.stage === 'transform') {
    const adminLevel = typeof input.adminLevel === 'number' ? `ADM${input.adminLevel}` : undefined;
    const bandId = typeof input.bandId === 'number' ? `band${input.bandId}` : undefined;
    return [adminLevel, bandId].filter(Boolean).join(' ');
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
  status: task.status,
  type: task.stage,
  index: task.index,
  progress: task.progress,
  startedAt: task.startedAt,
  completedAt: task.completedAt,
  retryCount: task.retryCount,
  error: task.errorMessage,
  message: task.message,
  title: buildTaskQueueTitle(task),
});

const summarizeTaskQueue = (tasks: TaskQueueRecord[]) => {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.status === 'completed' && !isSkippedMessage(task.message)).length;
  const failed = tasks.filter((task) => task.status === 'failed').length;
  const skipped = tasks.filter((task) => isSkippedMessage(task.message)).length;
  const runningTask = tasks.find((task) => task.status === 'running');
  const waitingTask = tasks.find((task) => task.status === 'waiting');
  const currentTask = runningTask?.taskId ?? waitingTask?.taskId;
  const stageOrder: Array<TaskQueueRecord['stage']> = ['fetch', 'transform', 'vt'];
  const currentStage = stageOrder.find((stage) => (
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
      currentStage,
      currentTask,
    },
  };
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
    });

    if (progressCallback) {
      const existing = progressCallbacks.get(String(nodeForSession));
      existing?.unsubscribe?.();
      const unsubscribe = onTaskQueueUpdate(nodeForSession, (event) => {
        progressCallback({
          nodeId: event.nodeId,
          stage: event.task.stage,
          phase: mapTaskQueueStatusToPhase(event.task.status),
          timestamp: Date.now(),
          message: event.task.message,
        });
      });
      progressCallbacks.set(String(nodeForSession), { unsubscribe });
    }

    return nodeForSession;
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
      const startedAt = Math.min(...vtTasks.map((task) => task.createdAt ?? Date.now()));
      return {
        draftId: nodeId,
        nodeId,
        status: summary.status,
        config,
        startedAt,
        updatedAt: Date.now(),
        completedAt: summary.status === 'completed' ? Date.now() : undefined,
        progress: summary.progress,
        canResume: false,
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
      return {
        nodeId,
        status: summary.status,
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
      return {
        exists: true,
        canResume: false,
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
    const unsubscribeTaskQueue = onTaskQueueUpdate(nodeId, (event) => {
      callback({
        nodeId: event.nodeId,
        stage: event.task.stage,
        phase: mapTaskQueueStatusToPhase(event.task.status),
        timestamp: Date.now(),
        message: event.task.message,
      });
    });
    const unsubscribe = () => {
      unsubscribeTaskQueue();
    };
    progressCallbacks.set(String(nodeId), { unsubscribe });

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
      const lastProcessed = vtTasks.reduce((latest, task) => {
        const candidate = task.completedAt ?? task.updatedAt ?? task.startedAt ?? task.createdAt ?? 0;
        return candidate > latest ? candidate : latest;
      }, 0);
      return {
        status: summary.status === 'running'
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
