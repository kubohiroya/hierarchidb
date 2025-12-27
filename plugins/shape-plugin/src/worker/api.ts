/**
 * Worker API implementation for Shape plugin
 * Exposes batch-oriented operations for runtime worker adapters
 */

import type { NodeId, TreeNodeId} from '@hierarchidb/common-types';
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
  type ShapeEntity,
  type TileInfo,
  type UrlMetadata,
  validateBatchConfig,
  type ShapeStepValidationResult,
} from '../common/types/index.js';
import { ShapeEntityHandler } from './handlers/index.js';

import { metadataLoader } from '../services/metadata/MetadataLoader.js';
import { createShapeBatchManager } from '../services/batch/UnifiedShapeBatchManager.js';
import { shapeDB, type BatchTaskRecord } from '../services/database/ShapeDB.js';
import type { BatchProcessConfig } from '../services/batch/types.js';
import { getEphemeralShapeDB } from '../services/database/EphemeralShapeDB.js';
import type { BatchStage, BatchTaskStatus } from '../common/types/BatchTaskLike.js';
import type { BatchProgressEvent as RuntimeBatchProgressEvent } from '@hierarchidb/common-api';
import {
  generateUrlMetadata,
  generateUrlMetadataFromSelection,
  getPreferredCountryCodeFormat,
} from '../services/utils/utils.js';
import { normalizeCountryCodeFormat } from '../services/utils/iso3166.js';
import { fetchGeoBoundariesAvailability } from '../services/utils/geoBoundariesAvailability.js';
import { downloadJson } from '../services/utils/downloadService.js';

// Create singleton unified batch manager
const batchSessionManager = createShapeBatchManager();
const batchManagerWithDispatch = batchSessionManager as unknown as {
  dispatchCommand?: (command: string, payload: Record<string, unknown>) => Promise<void>;
};

type BatchSessionStatusResult = Awaited<ReturnType<typeof batchSessionManager.getBatchSessionStatus>>;

type DraftLike = {
  nodeId?: NodeId;
  treeNodeId?: NodeId;
  batchSessionId?: string;
  draftData?: Partial<ShapeEntity>;
};

const getBatchSessionIdFromDraft = (draft: DraftLike | null | undefined): string | undefined =>
  draft?.batchSessionId ?? draft?.draftData?.batchSessionId;

const buildBatchSessionConfig = (batchConfig: BatchConfig, draft?: DraftLike): BatchSessionConfig => {
  const downloadConfig = batchConfig.downloadConfig ?? DEFAULT_PROCESSING_CONFIG.downloadConfig;
  const legacySimplification = batchConfig.simplificationConfig;
  const simplify1Config = batchConfig.simplify1Config ?? (legacySimplification ? {
    workers: legacySimplification.level1Workers,
    tolerance: legacySimplification.tolerance,
    featureFilterMethod: legacySimplification.featureFilterMethod,
    areaThreshold: legacySimplification.areaThreshold,
    minVertexCountForAreaFilter: legacySimplification.minVertexCountForAreaFilter,
    aspectRatioThreshold: legacySimplification.aspectRatioThreshold,
    hybridFilterConfig: legacySimplification.hybridFilterConfig,
  } : undefined) ?? DEFAULT_PROCESSING_CONFIG.simplify1Config;
  const simplify2Config = batchConfig.simplify2Config ?? (legacySimplification ? {
    workers: legacySimplification.level2Workers,
    tolerance: legacySimplification.tolerance,
    quantize: legacySimplification.quantize,
    enablePerFeatureSimplification: legacySimplification.enablePerFeatureSimplification,
  } : undefined) ?? DEFAULT_PROCESSING_CONFIG.simplify2Config;
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
    simplify1: {
      concurrentProcesses: simplify1Config?.workers ?? 2,
      enableFeatureFiltering: true,
      featureAreaThreshold: simplify1Config?.areaThreshold ?? 0.5,
      minVertexCountForAreaFilter: simplify1Config?.minVertexCountForAreaFilter ?? 25,
      aspectRatioThreshold: simplify1Config?.aspectRatioThreshold ?? 5,
      featureFilterMethod: simplify1Config?.featureFilterMethod ?? 'hybrid',
      hybridFilterConfig:
        simplify1Config?.hybridFilterConfig
        ?? DEFAULT_PROCESSING_CONFIG.simplify1Config?.hybridFilterConfig,
      deleteOnComplete: false,
    },
    simplify2: {
      concurrentProcesses: simplify2Config?.workers ?? 2,
      enablePerFeatureSimplification: simplify2Config?.enablePerFeatureSimplification ?? true,
      deleteOnComplete: false,
      quantize: simplify2Config?.quantize ?? 0,
      simplify: simplify2Config?.tolerance ?? 0,
      tolerance: simplify2Config?.tolerance ?? 0,
    },
    vectorTiles: {
      concurrentProcesses: tileConfig?.workers ?? 2,
      minZoom: tileConfig?.minZoom ?? 0,
      maxZoom: tileConfig?.maxZoom ?? 14,
      bufferSize: tileConfig?.bufferSize,
      tileSize: tileConfig?.tileSize,
    },
  };
};

const GEOBOUNDARIES_AVAILABILITY_URL = 'https://www.geoboundaries.org/api/current/gbOpen/ALL/ALL/';
const GEOBOUNDARIES_BASE_URL = 'https://www.geoboundaries.org/api/current/';
const GEOBOUNDARIES_RELEASE_TYPES = ['gbOpen'] as const;

const hasGeoBoundariesEntry = async (iso3: string, adminLevel: number): Promise<boolean> => {
  const adm = `ADM${adminLevel}`;
  for (const releaseType of GEOBOUNDARIES_RELEASE_TYPES) {
    const url = `${GEOBOUNDARIES_BASE_URL}${releaseType}/${iso3}/${adm}/`;
    try {
      await downloadJson<Record<string, unknown>>(
        url,
        `geoboundaries:metadata-check:${releaseType}:${iso3}:${adminLevel}`,
      );
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/HTTP 404/.test(message)) continue;
      console.warn('[ShapeBatch] GeoBoundaries metadata fetch failed', {
        releaseType,
        iso3,
        adminLevel,
        error: message,
      });
    }
  }
  return false;
};

const filterGeoBoundariesUrlMetadata = async (
  urlMetadata: UrlMetadata[],
): Promise<UrlMetadata[]> => {
  if (!urlMetadata.length) return urlMetadata;
  try {
    const { entries, totalItems } = await fetchGeoBoundariesAvailability(GEOBOUNDARIES_AVAILABILITY_URL);
    if (entries.size === 0) {
      console.warn('[ShapeBatch] GeoBoundaries availability empty. Skipping filter.', {
        totalItems,
      });
      return urlMetadata;
    }
    const filtered: UrlMetadata[] = [];
    let dropped = 0;
    let unavailable = 0;
    for (const metadata of urlMetadata) {
      const iso3 = await normalizeCountryCodeFormat(metadata.countryCode ?? '', 'iso3');
      const levels = entries.get(iso3);
      if (!levels?.includes(metadata.adminLevel)) {
        dropped += 1;
        continue;
      }
      const hasEntry = await hasGeoBoundariesEntry(iso3, metadata.adminLevel);
      if (!hasEntry) {
        unavailable += 1;
        continue;
      }
      filtered.push(metadata);
    }
    console.debug('[ShapeBatch] GeoBoundaries availability filter', {
      totalItems,
      availabilityCountries: entries.size,
      input: urlMetadata.length,
      output: filtered.length,
      dropped,
      unavailable,
    });
    return filtered;
  } catch (error) {
    console.warn('[ShapeBatch] failed to load GeoBoundaries availability', error);
    return urlMetadata;
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

const getOrCreateSessionMeta = (sessionId: string): ProgressSessionMeta => {
  let meta = progressSessionMeta.get(sessionId);
  if (!meta) {
    meta = {};
    progressSessionMeta.set(sessionId, meta);
  }
  return meta;
};

const mapStageToBatchStage = (stage?: string): BatchStage => {
  switch (stage) {
    case 'simplify1':
      return 'simplify1';
    case 'simplify2':
      return 'simplify2';
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
    case 'cancelled':
      return 'cancelled';
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
  sessionId: string,
): Promise<{ status?: BatchSessionStatusResult; missing: boolean; error?: unknown }> => {
  try {
    const status = await batchSessionManager.getBatchSessionStatus(sessionId);
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

const mapTaskStatusToStage = (status?: BatchTask['status']): BatchTask['stage'] => {
  switch (status) {
    case 'waiting':
      return 'wait';
    case 'running':
      return 'process';
    case 'completed':
      return 'success';
    case 'failed':
      return 'error';
    case 'cancelled':
      return 'cancel';
    default:
      return undefined;
  }
};

const buildTaskTitle = (task: BatchTaskRecord): string | undefined => {
  const input = task.inputData ?? {};
  const getNumber = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  if (task.taskType === 'download') {
    return (input.url as string | undefined) ?? (input.endpoint as string | undefined);
  }
  if (task.taskType === 'simplify1' || task.taskType === 'simplify2') {
    const sourceUrl = (input.sourceUrl ?? input.url) as string | undefined;
    const featureId = input.featureId as string | undefined;
    if (sourceUrl && featureId) return `${sourceUrl} • ${featureId}`;
    return sourceUrl ?? featureId;
  }
  if (task.taskType === 'vectortile') {
    const minZoom = getNumber(input.minZoom);
    const maxZoom = getNumber(input.maxZoom);
    const metadataContext = input.metadataContext as {
      dataSource?: string;
      countryCode?: string;
      countryName?: string;
      adminLevel?: number;
    } | undefined;
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
  stage: mapTaskStatusToStage(task.status),
  sessionId: task.sessionId,
  status: task.status,
  index: task.index,
  progress: task.progress,
  startedAt: task.startedAt,
  completedAt: task.completedAt,
  retryCount: task.retryCount,
  metadata: task.inputData,
  config: task.outputData,
  error: task.errorMessage,
  title: buildTaskTitle(task),
});

const buildBatchProgressEvent = (
  sessionId: string,
  progress: ProgressInfo,
  meta: ProgressSessionMeta,
): ShapeBatchProgressEvent => {
  const status = mapProgressToStatus(progress);
  return {
    sessionId,
    treeNodeId: (meta.treeNodeId ?? sessionId) as TreeNodeId,
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

const hydrateSessionMeta = async (sessionId: string): Promise<void> => {
  const meta = getOrCreateSessionMeta(sessionId);
  if (meta.treeNodeId) return;
  try {
    const db = getEphemeralShapeDB();
    const record = await db.sessions.get(sessionId);
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
    // Load from pre-fetched metadata files provided by @hierarchidb/runtime-worker-shared-fetch-metadata
    // Use the centralized MetadataLoader service for caching and transformation
    try {
      const data = await metadataLoader.loadMetadata(toDataSourceName(dataSource));
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

  generateUrlMetadata: async (
    dataSource: string,
    countries: string[],
    adminLevels: number[],
  ): Promise<UrlMetadata[]> => {
    // Get country metadata first
    const dataSourceName = toDataSourceName(dataSource);
    const preferredFormat = getPreferredCountryCodeFormat(dataSourceName);
    const normalizedCountries = await Promise.all(
      countries.map((code) => normalizeCountryCodeFormat(code, preferredFormat)),
    );
    const countryMetadata = await shapeBatchAPI.getCountryMetadata(dataSourceName);
    return generateUrlMetadata(dataSourceName, normalizedCountries, adminLevels, countryMetadata);
  },

  generateUrlMetadataFromSelection: async (
    dataSource: string,
    selectedArrayByCountries: boolean[][] | string | undefined,
  ): Promise<UrlMetadata[]> => {
    const dataSourceName = toDataSourceName(dataSource);
    const countryMetadata = await shapeBatchAPI.getCountryMetadata(dataSourceName);
    return generateUrlMetadataFromSelection(dataSourceName, selectedArrayByCountries, countryMetadata);
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

  startBatchProcessing: async (
    draftId: NodeId,
    batchConfig: BatchConfig,
    urlMetadata: UrlMetadata[],
    progressCallback?: (event: ShapeBatchProgressEvent) => void,
  ): Promise<string> => {
    if (!batchConfig?.dataSource) {
      throw new Error('Data source is required to start batch processing');
    }
    const validation = validateBatchConfig(batchConfig);
    if (!validation.isValid) {
      throw new Error(`Invalid processing config: ${validation.errors?.join(', ')}`);
    }

    // Get draft to find the associated nodeId
    const handler = getShapeEntityHandler();
    const draftLike = await handler.getEntity(draftId) as DraftLike;
    if (!draftLike) {
      throw new Error(`Working copy not found: ${draftId}`);
    }

    const downloadConfig = batchConfig.downloadConfig ?? DEFAULT_PROCESSING_CONFIG.downloadConfig;
    const resolvedDataSource = toDataSourceName(batchConfig.dataSource);
    const availabilityFilteredMetadata = resolvedDataSource === 'geoboundaries'
      ? await filterGeoBoundariesUrlMetadata(urlMetadata)
      : urlMetadata;
    if (!availabilityFilteredMetadata.length) {
      if (resolvedDataSource === 'geoboundaries') {
        throw new Error('No GeoBoundaries selections available after availability filter');
      }
      throw new Error('Shape batch session requires urlMetadata');
    }
    const baseConfig = buildBatchSessionConfig(batchConfig, { draftData: draftLike ?? undefined });
    const processConfig: BatchProcessConfig = {
      ...baseConfig,
      workerTimeout: downloadConfig?.timeoutMs,
      workerRetries: downloadConfig?.retryAttempts ?? 3,
      retryDelay: downloadConfig?.retryDelay,
      minZoom: baseConfig.vectorTiles?.minZoom,
      maxZoom: baseConfig.vectorTiles?.maxZoom,
    };

    const batchSessionData = { urlMetadata: availabilityFilteredMetadata };

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
    managerWithPrepare.prepareSession?.(nodeForSession, processConfig, batchSessionData, sessionOptions);
    const sessionId = await batchSessionManager.startBatchSession(nodeForSession);

    const sessionMeta = getOrCreateSessionMeta(sessionId);
    sessionMeta.treeNodeId = nodeForSession as unknown as TreeNodeId;

    // Register progress callback if provided
    if (progressCallback) {
      const existing = progressCallbacks.get(sessionId);
      existing?.unsubscribe?.();
      const unsubscribe = batchSessionManager.onBatchProgress(sessionId, (event) => {
        const info = batchEventToProgressInfo(event);
        const normalized = buildBatchProgressEvent(sessionId, info, sessionMeta);
        progressCallback(normalized);
      });
      progressCallbacks.set(sessionId, { unsubscribe });
    }

    // Save session ID to draft
    await handler.updateEntity(draftId, { batchSessionId: sessionId } as Partial<ShapeEntity>);

    return sessionId;
  },

  pauseBatchProcessing: async (draftId: NodeId): Promise<void> => {
    const handler = getShapeEntityHandler();
    const entity = await handler.getEntity(draftId);
    const batchSessionId = getBatchSessionIdFromDraft(entity as DraftLike | undefined);
    if (!entity || !batchSessionId) {
      throw new Error(`No active batch session for draft: ${draftId}`);
    }

    if (batchManagerWithDispatch.dispatchCommand) {
      await batchManagerWithDispatch.dispatchCommand('session/pause', {
        sessionId: batchSessionId,
      });
      return;
    }
    await batchSessionManager.pauseBatchSession(batchSessionId);
  },

  resumeBatchProcessing: async (draftId: NodeId): Promise<string> => {
    const handler = getShapeEntityHandler();
    const entity = await handler.getEntity(draftId);
    const batchSessionId = getBatchSessionIdFromDraft(entity as DraftLike | undefined);
    if (!entity || !batchSessionId) {
      throw new Error(`No batch session to resume for draft: ${draftId}`);
    }

    if (batchManagerWithDispatch.dispatchCommand) {
      await batchManagerWithDispatch.dispatchCommand('session/resume', {
        sessionId: batchSessionId,
      });
      return batchSessionId;
    }
    await batchSessionManager.resumeBatchSession(batchSessionId);
    return batchSessionId;
  },

  cancelBatchProcessing: async (draftId: NodeId): Promise<void> => {
    const handler = getShapeEntityHandler();
    const entity = await handler.getEntity(draftId);
    const batchSessionId = getBatchSessionIdFromDraft(entity as DraftLike | undefined);
    if (!entity || !batchSessionId) {
      throw new Error(`No active batch session for draft: ${draftId}`);
    }

    if (batchManagerWithDispatch.dispatchCommand) {
      await batchManagerWithDispatch.dispatchCommand('session/cancel', {
        sessionId: batchSessionId,
      });
    } else {
      await batchSessionManager.cancelBatchSession(batchSessionId);
    }
    const subscription = progressCallbacks.get(batchSessionId);
    subscription?.unsubscribe?.();
    progressCallbacks.delete(batchSessionId);
    progressSessionMeta.delete(batchSessionId);

    // Clear session ID from draft
    await handler.updateEntity(draftId, { batchSessionId: undefined } as Partial<ShapeEntity>);
  },

  invokeBatchCommand: async <K extends ShapeBatchCommand>(
    command: K,
    payload: ShapeBatchCommandPayload<K>,
  ): Promise<void> => {
    if (batchManagerWithDispatch.dispatchCommand) {
      await batchManagerWithDispatch.dispatchCommand(command, payload);
      return;
    }
    const sessionId = (payload as { sessionId?: string }).sessionId;
    if (!sessionId) {
      console.warn('[shapeBatchAPI] batch command missing sessionId', command);
      return;
    }
    switch (command) {
      case 'session/pause':
        await batchSessionManager.pauseBatchSession(sessionId);
        break;
      case 'session/resume':
        await batchSessionManager.resumeBatchSession(sessionId);
        break;
      case 'session/cancel':
        await batchSessionManager.cancelBatchSession(sessionId);
        break;
      default:
        console.warn('[shapeBatchAPI] batch command unavailable in unified manager', command);
        break;
    }
  },

  getBatchSession: async (sessionId: string): Promise<BatchSession | undefined> => {
    try {
      const { status, missing, error } = await getBatchSessionStatusSafe(sessionId);
      if (!status) {
        if (!missing && error) {
          console.warn('[shapeBatchAPI] failed to fetch batch session', error);
        }
        return undefined;
      }
      const nodeId = status.nodeId as NodeId;
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
        sessionId: status.sessionId,
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

  getBatchTasks: async (sessionId: string): Promise<BatchTask[]> => {
    const tasks = await shapeDB.getBatchTasks(sessionId);
    return tasks.map(mapTaskRecordToBatchTask);
  },

  getBatchProgress: async (draftId: NodeId): Promise<ProgressInfo> => {
    const handler = getShapeEntityHandler();
    const entity = await handler.getEntity(draftId);
    const batchSessionId = getBatchSessionIdFromDraft(entity as DraftLike | undefined);
    if (!entity || !batchSessionId) {
      return {
        total: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 0,
      };
    }
    try {
      const status = await batchSessionManager.getBatchSessionStatus(batchSessionId);
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
    sessionId: string,
  ): Promise<{
    sessionId: string;
    draftId?: NodeId;
    status: string;
    progress?: number;
    completedTasks?: number;
    totalTasks?: number;
  }> => {
    try {
      const status = await batchSessionManager.getBatchSessionStatus(sessionId);
      const normalizedStatus = mapManagerStatusToShapeStatus(status.status);
      return {
        sessionId,
        draftId: status.nodeId as NodeId,
        status: normalizedStatus,
        progress: status.progress?.percentage,
        completedTasks: status.progress?.completed,
        totalTasks: status.progress?.total,
      };
    } catch (error) {
      console.warn('[shapeBatchAPI] failed to fetch batch status', error);
      return {
        sessionId,
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
    sessionId: string,
  ): Promise<{
    exists: boolean;
    canResume: boolean;
    lastActivity: number;
    expiresAt: number;
  }> => {
    try {
      const status = await batchSessionManager.getBatchSessionStatus(sessionId);
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

  subscribeToProgress: (sessionId: string, callback: (event: ShapeBatchProgressEvent) => void): (() => void) => {
    const sessionMeta = getOrCreateSessionMeta(sessionId);
    if (!sessionMeta.treeNodeId) {
      void hydrateSessionMeta(sessionId);
    }
    const existing = progressCallbacks.get(sessionId);
    existing?.unsubscribe?.();
    const unsubscribe = batchSessionManager.onBatchProgress(sessionId, (event) => {
      const info = batchEventToProgressInfo(event);
      const normalized = buildBatchProgressEvent(sessionId, info, sessionMeta);
      callback(normalized);
    });
    progressCallbacks.set(sessionId, { unsubscribe });

    return () => {
      const active = progressCallbacks.get(sessionId);
      active?.unsubscribe?.();
      progressCallbacks.delete(sessionId);
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

    // Try to reflect batch session status if available
    if (entity.batchSessionId) {
      const { status, missing, error } = await getBatchSessionStatusSafe(entity.batchSessionId);
      if (missing) {
        await handler.updateEntity(nodeId, { batchSessionId: undefined } as Partial<ShapeEntity>);
      } else if (error) {
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
    const sessions = await shapeDB.batchSessions.where('nodeId').equals(nodeId).toArray();
    for (const session of sessions) {
      await shapeDB.batchTasks.where('sessionId').equals(session.sessionId).delete();
    }
    await shapeDB.batchSessions.where('nodeId').equals(nodeId).delete();
    await shapeDB.features.where('nodeId').equals(nodeId).delete();
    await shapeDB.featureBuffers.where('nodeId').equals(nodeId).delete();
    await shapeDB.tileBuffers.where('nodeId').equals(nodeId).delete();
    await shapeDB.vectorTiles.where('nodeId').equals(nodeId).delete();
    await shapeDB.cache.where('nodeId').equals(nodeId).delete();
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
