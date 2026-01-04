/**
 * Worker API implementation for Shape plugin
 * Exposes batch-oriented operations for runtime worker adapters
 */

import { toNodeId, type NodeId, type TreeNodeId } from '@hierarchidb/common-types';
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
  type ProcessingStage,
  type BatchProgressEvent as ShapeBatchProgressEvent,
  type ShapeBatchCommand,
  type ShapeBatchCommandPayload,
  type ProgressInfo,
  type TileInfo,
  type DownloadTaskPayload,
  validateBatchConfig,
  type ShapeStepValidationResult,
  BatchTaskStage,
} from '../common/types/index.js';
import { ShapeEntityHandler } from './handlers/index.js';

import { metadataLoader } from '../services/metadata/MetadataLoader.js';
import { UnifiedShapeBatchManager } from '../services/batch/UnifiedShapeBatchManager.js';
import {
  shapeDB,
  type BatchTaskRecord,
  type DownloadTaskInputData,
  type Extract1TaskInputData,
  type Extract2TaskInputData,
  type VectorTileTaskInputData,
} from '../services/database/ShapeDB.js';
import type { BatchProcessConfig } from '../services/batch/types.js';
import { getEphemeralShapeDB } from '../services/database/EphemeralShapeDB.js';
import type { BatchStage, BatchTaskStatus } from '../common/types/BatchTaskLike.js';
import type { BatchProgressEvent as RuntimeBatchProgressEvent } from '@hierarchidb/common-api';
import {
  buildDownloadTaskId,
  generateDownloadTaskPayloads,
  getPreferredCountryCodeFormat,
} from '../services/utils/utils.js';
import { normalizeCountryCodeFormat } from '../services/utils/iso3166.js';
import { resolveDownloadStageStrategy } from '../services/batch/strategies/resolveDownloadStageStrategy.js';
import type { SelectedArrayByCountries, ShapeEntity } from '../common/types/ShapeEntity.ts';

// Create singleton unified batch manager
const batchSessionManager = new UnifiedShapeBatchManager();
const batchManagerWithDispatch = batchSessionManager as unknown as {
  dispatchCommand?: (command: string, payload: Record<string, unknown>) => Promise<void>;
};

type BatchSessionStatusResult = Awaited<ReturnType<typeof batchSessionManager.getBatchSessionStatus>>;

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
  const resolvedDataSource =
    batchConfig.dataSource
    ?? toDataSourceName(draft?.draftData?.batchConfig?.dataSource ?? 'naturalearth');

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

const persistDownloadTaskPayloads = async (
  nodeId: NodeId,
  payloads: DownloadTaskPayload[],
  buildStartedAt: number,
): Promise<void> => {
  if (payloads.length === 0) return;
  const existingTasks = await shapeDB.batchTasks
    .where('nodeId')
    .equals(nodeId)
    .and((task) => task.taskType === 'download')
    .toArray();
  const incompleteTasks = existingTasks.filter((task) => task.status !== 'completed');
  if (incompleteTasks.length > 0) {
    await shapeDB.batchTasks.bulkDelete(incompleteTasks.map((task) => task.taskId));
  }
  const incompleteIds = new Set(incompleteTasks.map((task) => task.taskId));
  const activeTasks = existingTasks.filter((task) => !incompleteIds.has(task.taskId));
  const existingTaskIds = new Set(activeTasks.map((task) => task.taskId));
  let nextIndex = activeTasks.reduce((max, task) => Math.max(max, task.index ?? 0), -1) + 1;
  const candidates = payloads.map((payload) => ({
    payload,
    taskId: buildDownloadTaskId(nodeId, payload),
  }));
  const needRegistered = candidates.filter((candidate) => !existingTaskIds.has(candidate.taskId));
  const createdAt = Number.isFinite(buildStartedAt) && buildStartedAt > 0 ? buildStartedAt : Date.now();
  const newTasks: BatchTaskRecord[] = needRegistered.map(({ payload, taskId }) => {
    const task: BatchTaskRecord = {
      taskId,
      nodeId,
      taskType: 'download',
      status: 'waiting',
      index: nextIndex,
      progress: 0,
      inputData: payload as DownloadTaskInputData,
      createdAt,
      updatedAt: createdAt,
    };
    nextIndex += 1;
    return task;
  });
  console.debug('[ShapeBatch] download task registration', {
    registered: existingTaskIds.size,
    needRegistered: needRegistered.length,
    total: candidates.length,
  });
  if (newTasks.length > 0) {
    await shapeDB.batchTasks.bulkPut(newTasks);
  }
};

interface ProgressSubscription {
  unsubscribe?: () => void;
}

interface ProgressSessionMeta {
  treeNodeId?: TreeNodeId;
}

const progressCallbacks = new Map<string, ProgressSubscription>();
const progressSessionMeta = new Map<string, ProgressSessionMeta>();

const shapeEntityHandlerSingleton = new ShapeEntityHandler();
const getShapeEntityHandler = (): ShapeEntityHandler => shapeEntityHandlerSingleton;

const getOrCreateNodeMeta = (nodeId: string): ProgressSessionMeta => {
  let meta = progressSessionMeta.get(nodeId);
  if (!meta) {
    meta = {};
    progressSessionMeta.set(nodeId, meta);
  }
  return meta;
};

const mapStageToBatchStage = (stage?: string): BatchStage => {
  switch (stage) {
    case 'extract1':
      return 'extract1';
    case 'extract2':
      return 'extract2';
    case 'vectortile':
    case 'vectorTiles':
      return 'vectorTiles';
    case 'download':
    default:
      return 'download';
  }
};

const mapStageToProcessingStage = (stage?: string): ProcessingStage | 'processing' =>
  mapStageToBatchStage(stage) as ProcessingStage;

const mapManagerStatusToShapeStatus = (
  status: string,
): BatchSession['status'] => {
  switch (status) {
    case 'paused':
      return 'paused';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'running':
    case 'idle':
    default:
      return 'running';
  }
};

const isSessionNotFoundError = (error: unknown): boolean => (
  error instanceof Error && /session .*not found/i.test(error.message)
);

const getBatchSessionStatusSafe = async (
  nodeId: NodeId,
): Promise<{ status?: BatchSessionStatusResult; missing: boolean; error?: unknown }> => {
  try {
    const status = await batchSessionManager.getBatchSessionStatus(nodeId);
    return { status, missing: false };
  } catch (error) {
    if (isSessionNotFoundError(error)) {
      return { missing: true };
    }
    return { missing: false, error };
  }
};

const mapProgressToStatus = (progress: ProgressInfo): BatchTaskStatus => {
  if (progress.failed > 0) return 'failed';
  if (progress.total > 0 && progress.completed >= progress.total) return 'completed';
  return 'running';
};

const buildTaskTitle = (task: BatchTaskRecord): string | undefined => {
  const getNumber = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  if (task.taskType === 'download') {
    const input = task.inputData as DownloadTaskInputData | undefined;
    return input?.url ?? input?.endpoint;
  }
  if (task.taskType === 'extract1') {
    const input = task.inputData as Extract1TaskInputData | undefined;
    const sourceUrl = input?.sourceUrl;
    const featureId = input?.featureId;
    if (sourceUrl && featureId) return `${sourceUrl} • ${featureId}`;
    return sourceUrl ?? featureId;
  }
  if (task.taskType === 'extract2') {
    const input = task.inputData as Extract2TaskInputData | undefined;
    const dataSource = typeof input?.dataSource === 'string'
      ? input.dataSource.toUpperCase()
      : undefined;
    const continent = typeof input?.continent === 'string' ? input.continent : undefined;
    const adminLevel = getNumber(input?.adminLevel);
    const adminLabel = adminLevel != null ? `ADM${adminLevel}` : undefined;
    const parts = [dataSource, continent, adminLabel].filter(Boolean);
    if (parts.length > 0) return parts.join(' • ');
    const sourceUrl = input?.sourceUrl;
    const featureId = input?.featureId;
    if (sourceUrl && featureId) return `${sourceUrl} • ${featureId}`;
    return sourceUrl ?? featureId;
  }
  if (task.taskType === 'vectortile') {
    const input = task.inputData as VectorTileTaskInputData | undefined;
    const minZoom = getNumber(input?.minZoom);
    const maxZoom = getNumber(input?.maxZoom);
    const metadataContext = input?.metadataContext;
    const countryLabel = metadataContext?.countryName ?? metadataContext?.countryCode;
    const adminLabel = metadataContext?.adminLevel != null ? `ADM${metadataContext.adminLevel}` : undefined;
    const dataSourceLabel = metadataContext?.dataSource ? metadataContext.dataSource.toUpperCase() : undefined;
    const zoomLabel = typeof minZoom === 'number' && typeof maxZoom === 'number'
      ? `z${minZoom}-${maxZoom}`
      : undefined;
    const parts = [dataSourceLabel, countryLabel, adminLabel, zoomLabel].filter(Boolean);
    if (parts.length > 0) return parts.join(' • ');
    if (typeof minZoom === 'number' && typeof maxZoom === 'number') return `z${minZoom}-${maxZoom}`;
  }
  return undefined;
};

const mapTaskRecordToBatchTask = (task: BatchTaskRecord): BatchTask & { title?: string } => ({
  taskId: task.taskId,
  taskType: task.taskType,
  nodeId: task.nodeId,
  stage:
    task.status === 'waiting'
      ? BatchTaskStage.WAIT
      : task.status === 'running'
        ? BatchTaskStage.PROCESS
        : task.status === 'completed'
          ? BatchTaskStage.SUCCESS
          : BatchTaskStage.ERROR,
  status: task.status,
  type: task.taskType,
  index: task.index,
  progress: task.progress,
  startedAt: task.startedAt,
  completedAt: task.completedAt,
  retryCount: task.retryCount,
  error: task.errorMessage,
  title: buildTaskTitle(task),
});

const buildBatchProgressEvent = (
  nodeId: string,
  progress: ProgressInfo,
  meta: ProgressSessionMeta,
): ShapeBatchProgressEvent => {
  const status = mapProgressToStatus(progress);
  return {
    nodeId,
    treeNodeId: (meta.treeNodeId ?? nodeId) as TreeNodeId,
    stage: mapStageToBatchStage(progress.currentStage),
    status,
    progress: Math.round(progress.percentage ?? 0),
    completedTasks: progress.completed,
    totalTasks: progress.total,
    currentTask: progress.currentTask ?? '',
    message: progress.currentTask,
    timestamp: Date.now(),
    type: status === 'completed' ? 'complete' : status === 'failed' ? 'error' : 'progress',
  };
};

const batchEventToProgressInfo = (event: RuntimeBatchProgressEvent): ProgressInfo => {
  const payload = event.payload ?? {};
  const total = payload.total ?? 0;
  const completed = payload.completed ?? 0;
  const failed = payload.failed ?? 0;
  const skipped = payload.skipped ?? Math.max(total - completed - failed, 0);
  const percentageFromPayload = payload.meta?.percentage;
  const percentage = typeof percentageFromPayload === 'number'
    ? percentageFromPayload
    : total > 0
      ? Math.round((completed / total) * 100)
      : 0;
  return {
    total,
    completed,
    failed,
    skipped,
    percentage,
    currentStage: mapStageToProcessingStage(event.stage),
    currentTask: payload.currentTask ?? event.message,
  };
};

const hydrateSessionMeta = async (nodeId: string): Promise<void> => {
  const meta = getOrCreateNodeMeta(nodeId);
  if (meta.treeNodeId) return;
  try {
    const db = getEphemeralShapeDB();
    const record = await db.sessions.get(nodeId);
    if (record?.nodeId) {
      meta.treeNodeId = record.nodeId as unknown as TreeNodeId;
    }
  } catch (error) {
    console.warn('[shapeBatchAPI] Failed to hydrate session metadata', error);
  }
};

export const shapeBatchAPI = {

  // ===================================
  // Data Source Operations
  // ===================================

  getDataSourceConfigs: async (): Promise<DataSourceConfig[]> => {
    return SHAPE_DATA_SOURCES;
  },

  getCountryMetadata: async (dataSource: string | DataSourceName): Promise<CountryMetadata[]> => {
    const normalized = toDataSourceName(dataSource);
    if (normalized === 'openstreetmap') {
      throw new Error('OpenStreetMap is not supported in Step3 country selection.');
    }
    try {
      const data = await metadataLoader.loadMetadata(normalized);
      if (Array.isArray(data) && data.length > 0) return data;
    } catch (err) {
      console.error('Failed to load country metadata for data source:', dataSource, err);
    }
    // Fallback minimal metadata for tests/offline
    return [
      { countryCode: 'US', countryName: 'United States', continent: 'North America', availableAdminLevels: [0, 1, 2] },
      { countryCode: 'JP', countryName: 'Japan', continent: 'Asia', availableAdminLevels: [0, 1, 2] },
    ];
  },

  generateDownloadTaskPayloads: async (
    dataSource: string,
    countries: string[],
    adminLevels: number[],
  ): Promise<DownloadTaskPayload[]> => {
    // Get country metadata first
    const dataSourceName = toDataSourceName(dataSource);
    const preferredFormat = getPreferredCountryCodeFormat(dataSourceName);
    const normalizedCountries = await Promise.all(
      countries.map((code) => normalizeCountryCodeFormat(code, preferredFormat)),
    );
    const countryMetadata = await shapeBatchAPI.getCountryMetadata(dataSourceName);
    return generateDownloadTaskPayloads(dataSourceName, normalizedCountries, adminLevels, countryMetadata);
  },

  generateDownloadTaskPayloadsFromSelection: async (
    dataSource: string,
    selectedArrayByCountries: SelectedArrayByCountries | undefined,
  ): Promise<DownloadTaskPayload[]> => {
    const dataSourceName = toDataSourceName(dataSource);
    const countryMetadata = await shapeBatchAPI.getCountryMetadata(dataSourceName);
    const strategy = resolveDownloadStageStrategy(dataSourceName);
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
    dataSource: string,
  ): Promise<ShapeStepValidationResult> => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const dataSourceName = toDataSourceName(dataSource);

    if (countries.length === 0) {
      errors.push('At least one country must be selected');
    }

    if (adminLevels.length === 0) {
      errors.push('At least one administrative level must be selected');
    }

    if (!SHAPE_DATA_SOURCES.find((ds: DataSourceConfig) => ds.name === dataSourceName)) {
      errors.push('Invalid data source selected');
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
    progressCallback?: (event: ShapeBatchProgressEvent) => void,
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

    const downloadConfig = batchConfig.downloadConfig ?? DEFAULT_PROCESSING_CONFIG.downloadConfig;
    if (!downloadTaskPayloads.length) {
      throw new Error('Shape batch session requires download task payloads');
    }
    const baseConfig = buildBatchSessionConfig(mergedBatchConfig, { draftData: draftLike ?? undefined });
    const processConfig: BatchProcessConfig = {
      ...baseConfig,
      workerTimeout: downloadConfig?.timeoutMs,
      workerRetries: downloadConfig?.retryAttempts ?? 3,
      retryDelay: downloadConfig?.retryDelay,
      minZoom: baseConfig.vectorTiles?.minZoom,
      maxZoom: baseConfig.vectorTiles?.maxZoom,
    };

    const buildStartedAt = Date.now();
    const batchSessionData = { downloadTaskPayloads: downloadTaskPayloads, buildStartedAt };

    // Start batch session using unified manager
    const sessionOptions = {
      maxConcurrentTasks: undefined,
      retryAttempts: downloadConfig?.retryAttempts ?? 3,
      retryDelay: downloadConfig?.retryDelay,
      timeoutMs: downloadConfig?.timeoutMs,
      enableResourceTracking: false,
    };

    const managerWithPrepare = batchSessionManager as unknown as {
      prepareSession?: (
        nodeId: NodeId,
        config: BatchProcessConfig,
        data: typeof batchSessionData,
        options?: typeof sessionOptions,
      ) => void;
    };
    const nodeForSession = draftLike.nodeId ?? draftLike.treeNodeId ?? draftId;
    console.debug('[ShapeBatch] startBatchProcess config', {
      nodeId: nodeForSession,
      extract2Config: mergedBatchConfig.extract2Config,
      extractionMode: mergedBatchConfig.extract2Config?.extractionMode,
      tileConfig: mergedBatchConfig.tileConfig,
      vectorTiles: baseConfig.vectorTiles,
    });
    await persistDownloadTaskPayloads(toNodeId(String(nodeForSession)), downloadTaskPayloads, buildStartedAt);
    managerWithPrepare.prepareSession?.(nodeForSession, processConfig, batchSessionData, sessionOptions);
    await batchSessionManager.startBatchSession(nodeForSession);

    const sessionMeta = getOrCreateNodeMeta(String(nodeForSession));
    sessionMeta.treeNodeId = nodeForSession as unknown as TreeNodeId;

    // Register progress callback if provided
    if (progressCallback) {
      const existing = progressCallbacks.get(String(nodeForSession));
      existing?.unsubscribe?.();
      const unsubscribe = batchSessionManager.onBatchProgress(nodeForSession, (event) => {
        const info = batchEventToProgressInfo(event);
        const normalized = buildBatchProgressEvent(String(nodeForSession), info, sessionMeta);
        progressCallback(normalized);
      });
      progressCallbacks.set(String(nodeForSession), { unsubscribe });
    }

    return nodeForSession;
  },

  pauseBatchProcessing: async (draftId: NodeId): Promise<void> => {
    const handler = getShapeEntityHandler();
    const entity = await handler.getEntity(draftId);
    const nodeId = resolveBatchNodeId(entity as DraftLike | undefined);
    if (!entity || !nodeId) {
      throw new Error(`No active batch session for draft: ${draftId}`);
    }

    if (batchManagerWithDispatch.dispatchCommand) {
      await batchManagerWithDispatch.dispatchCommand('session/pause', {
        nodeId,
      });
      return;
    }
    await batchSessionManager.pauseBatchSession(nodeId);
  },

  resumeBatchProcessing: async (draftId: NodeId): Promise<NodeId> => {
    const handler = getShapeEntityHandler();
    const entity = await handler.getEntity(draftId);
    const nodeId = resolveBatchNodeId(entity as DraftLike | undefined);
    if (!entity || !nodeId) {
      throw new Error(`No batch session to resume for draft: ${draftId}`);
    }
    const mergedConfig = mergeBatchConfig(entity?.batchConfig ?? DEFAULT_PROCESSING_CONFIG);
    const desiredConfig = buildBatchSessionConfig(mergedConfig, { draftData: entity ?? undefined });
    const session = await shapeDB.getBatchSession(nodeId);
    if (session?.config?.vectorTiles && desiredConfig.vectorTiles) {
      const currentMin = session.config.vectorTiles.minZoom;
      const currentMax = session.config.vectorTiles.maxZoom;
      const desiredMin = desiredConfig.vectorTiles.minZoom;
      const desiredMax = desiredConfig.vectorTiles.maxZoom;
      if (currentMin !== desiredMin || currentMax !== desiredMax) {
        console.warn('[shapeBatchAPI] resume blocked: zoom range mismatch', {
          nodeId,
          current: { minZoom: currentMin, maxZoom: currentMax },
          desired: { minZoom: desiredMin, maxZoom: desiredMax },
        });
        throw new Error('Zoom range changed. Restart build to apply the new range.');
      }
    }
    if (batchManagerWithDispatch.dispatchCommand) {
      await batchManagerWithDispatch.dispatchCommand('session/resume', {
        nodeId,
      });
      return nodeId;
    }
    await batchSessionManager.resumeBatchSession(nodeId);
    return nodeId;
  },

  invokeBatchCommand: async <K extends ShapeBatchCommand>(
    command: K,
    payload: ShapeBatchCommandPayload<K>,
  ): Promise<void> => {
    if (batchManagerWithDispatch.dispatchCommand) {
      await batchManagerWithDispatch.dispatchCommand(command, payload);
      return;
    }
    const nodeId = (payload as { nodeId?: NodeId }).nodeId;
    if (!nodeId) {
      console.warn('[shapeBatchAPI] batch command missing nodeId', command);
      return;
    }
    switch (command) {
      case 'session/pause':
        await batchSessionManager.pauseBatchSession(nodeId);
        break;
      case 'session/resume':
        await batchSessionManager.resumeBatchSession(nodeId);
        break;
      default:
        console.warn('[shapeBatchAPI] batch command unavailable in unified manager', command);
        break;
    }
  },

  getBatchSession: async (nodeId: NodeId): Promise<BatchSession | undefined> => {
    try {
      const { status, missing, error } = await getBatchSessionStatusSafe(nodeId);
      if (!status) {
        if (!missing && error) {
          console.warn('[shapeBatchAPI] failed to fetch batch session', error);
        }
        return undefined;
      }
      const handler = getShapeEntityHandler();
      const entity = await handler.getEntity(nodeId);
      const mergedConfig = mergeBatchConfig(entity?.batchConfig ?? DEFAULT_PROCESSING_CONFIG);
      const config = buildBatchSessionConfig(mergedConfig, { draftData: entity ?? undefined });
      const progress = status.progress ?? {
        total: 0,
        completed: 0,
        failed: 0,
        percentage: 0,
      };
      const normalizedStatus = mapManagerStatusToShapeStatus(status.status);
      return {
        draftId: nodeId,
        nodeId,
        status: normalizedStatus,
        config,
        startedAt: status.startedAt ?? Date.now(),
        updatedAt: status.lastActivity ?? status.startedAt ?? Date.now(),
        completedAt: status.completedAt,
        progress: {
          total: progress.total ?? 0,
          completed: progress.completed ?? 0,
          failed: progress.failed ?? 0,
          skipped: progress.skipped ?? 0,
          percentage: progress.percentage ?? 0,
          currentStage: mapStageToProcessingStage(progress.currentStage),
          currentTask: progress.currentTask,
        },
        canResume: normalizedStatus === 'paused',
        lastActivity: status.lastActivity ?? status.startedAt ?? Date.now(),
        expiresAt: status.lastActivity ?? Date.now(),
        stages: {},
        resourceUsage: undefined,
      };
    } catch (error) {
      if (!isSessionNotFoundError(error)) {
        console.warn('[shapeBatchAPI] failed to fetch batch session', error);
      }
      return undefined;
    }
  },

  getBatchTasks: async (nodeId: NodeId): Promise<BatchTask[]> => {
    const tasks = await shapeDB.getBatchTasks(nodeId);
    return tasks.map(mapTaskRecordToBatchTask);
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
    try {
      const status = await batchSessionManager.getBatchSessionStatus(nodeId);
      const progress = status.progress ?? {
        total: 0,
        completed: 0,
        failed: 0,
        percentage: 0,
      };
      return {
        total: progress.total ?? 0,
        completed: progress.completed ?? 0,
        failed: progress.failed ?? 0,
        skipped: progress.skipped ?? 0,
        percentage: progress.percentage ?? 0,
        currentStage: mapStageToProcessingStage(progress.currentStage),
        currentTask: progress.currentTask,
      };
    } catch {
      return {
        total: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 0,
      };
    }
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
    try {
      const status = await batchSessionManager.getBatchSessionStatus(nodeId);
      const normalizedStatus = mapManagerStatusToShapeStatus(status.status);
      return {
        nodeId,
        draftId: status.nodeId as NodeId,
        status: normalizedStatus,
        progress: status.progress?.percentage,
        completedTasks: status.progress?.completed,
        totalTasks: status.progress?.total,
      };
    } catch (error) {
      console.warn('[shapeBatchAPI] failed to fetch batch status', error);
      return {
        nodeId,
        status: 'idle',
      };
    }
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
    try {
      const status = await batchSessionManager.getBatchSessionStatus(nodeId);
      const lastActivity = status.lastActivity ?? status.startedAt ?? Date.now();
      const normalizedStatus = mapManagerStatusToShapeStatus(status.status);
      return {
        exists: true,
        canResume: normalizedStatus === 'paused',
        lastActivity,
        expiresAt: lastActivity + 5 * 60 * 1000,
      };
    } catch {
      return {
        exists: false,
        canResume: false,
        lastActivity: 0,
        expiresAt: 0,
      };
    }
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

  subscribeToProgress: (nodeId: NodeId, callback: (event: ShapeBatchProgressEvent) => void): (() => void) => {
    const sessionMeta = getOrCreateNodeMeta(String(nodeId));
    if (!sessionMeta.treeNodeId) {
      void hydrateSessionMeta(String(nodeId));
    }
    const existing = progressCallbacks.get(String(nodeId));
    existing?.unsubscribe?.();
    const unsubscribe = batchSessionManager.onBatchProgress(nodeId, (event) => {
      const info = batchEventToProgressInfo(event);
      const normalized = buildBatchProgressEvent(String(nodeId), info, sessionMeta);
      callback(normalized);
    });
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
    return shapeDB.features.where('nodeId').equals(nodeId).count();
  },

  getVectorTileInfo: async (
    nodeId: NodeId,
    z: number,
    x: number,
    y: number,
  ): Promise<TileInfo | undefined> => {
    const tile = await shapeDB.getVectorTile(nodeId, z, x, y);
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

    // NodeId is the only batch session identifier.
    const { status, missing, error } = await getBatchSessionStatusSafe(nodeId);
    if (!missing) {
      if (error) {
        console.warn('[shapeBatchAPI] failed to fetch batch session status', error);
      } else if (status) {
        const normalizedStatus = mapManagerStatusToShapeStatus(status.status);
        return {
          status: normalizedStatus === 'running'
            ? 'processing'
            : normalizedStatus === 'completed'
              ? 'completed'
              : normalizedStatus === 'failed'
                ? 'failed'
                : 'idle',
          lastProcessed: status.lastActivity ?? status.startedAt,
          hasErrors: normalizedStatus === 'failed',
          errorMessages: normalizedStatus === 'failed' ? ['Batch processing failed'] : [],
          // Optionally map aggregates if available
          totalFeatures: undefined,
          totalVectorTiles: undefined,
          storageUsed: undefined,
        };
      }
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
    const ephemeral = getEphemeralShapeDB();
    await shapeDB.batchTasks.where('nodeId').equals(nodeId).delete();
    await shapeDB.batchSessions.where('nodeId').equals(nodeId).delete();
    await shapeDB.features.where('nodeId').equals(nodeId).delete();
    await ephemeral.featureBuffers.where('nodeId').equals(nodeId).delete();
    await ephemeral.tileBuffers.where('nodeId').equals(nodeId).delete();
    await shapeDB.vectorTiles.where('nodeId').equals(nodeId).delete();
    const cacheKeys = await ephemeral.cache
      .filter((entry) => entry.key.includes(String(nodeId)))
      .primaryKeys();
    if (cacheKeys.length > 0) {
      await ephemeral.cache.bulkDelete(cacheKeys);
    }
  },
};

function toDataSourceName(value: string | DataSourceName): DataSourceName {
  if (isDataSourceName(value)) return value;
  const normalized = value.trim().toLowerCase();
  if (isDataSourceName(normalized)) return normalized;
  console.warn('[shape-plugin] Unknown data source name:', value, '—fallback to naturalearth');
  return 'naturalearth';
}

function isDataSourceName(value: string): value is DataSourceName {
  return value === 'naturalearth' ||
    value === 'geoboundaries' ||
    value === 'gadm' ||
    value === 'openstreetmap';
}
