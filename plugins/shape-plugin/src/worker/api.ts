/**
 * Worker API implementation for Shape plugin
 * Implements ShapeAPI interface from shared layer
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
  mergeProcessingConfig,
  type ProcessingConfig,
  type ProcessingStatus,
  type ProcessingStage,
  type BatchProgressEvent as ShapeBatchProgressEvent,
  type ShapeBatchCommand,
  type ShapeBatchCommandPayload,
  type ProgressInfo,
  type SelectionStats,
  type ShapeEntity,
  type TileInfo,
  type UrlMetadata,
  validateProcessingConfig,
  type ShapeStepValidationResult,
} from '../common/types/index.js';
import { ShapeEntityHandler } from './handlers/index.js';

import { metadataLoader } from '../services/metadata/MetadataLoader.js';
import { createShapeBatchManager } from '../services/batch/UnifiedShapeBatchManager.js';
import type { BatchProcessConfig } from '../services/batch/types.js';
import { getEphemeralShapeDB } from '../services/database/EphemeralShapeDB.js';
import type { BatchStage, BatchTaskStatus } from '../common/types/BatchTaskLike.js';
import type { BatchProgressEvent as RuntimeBatchProgressEvent } from '@hierarchidb/common-api';
import { calculateSelectionStats, generateUrlMetadata } from '../services/utils/utils.js';

// Create singleton unified batch manager
const batchSessionManager = createShapeBatchManager();
const batchManagerWithDispatch = batchSessionManager as unknown as {
  dispatchCommand?: (command: string, payload: Record<string, unknown>) => Promise<void>;
};

type DraftLike = {
  nodeId?: NodeId;
  treeNodeId?: NodeId;
  batchSessionId?: string;
  draftData?: Partial<ShapeEntity>;
};

const getBatchSessionIdFromDraft = (draft: DraftLike | null | undefined): string | undefined =>
  draft?.batchSessionId ?? draft?.draftData?.batchSessionId;

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

const mapProgressToStatus = (progress: ProgressInfo): BatchTaskStatus => {
  if (progress.failed > 0) return 'failed';
  if (progress.total > 0 && progress.completed >= progress.total) return 'completed';
  return 'running';
};

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
    console.warn('[shapePluginAPI] Failed to hydrate session metadata', error);
  }
};

export const shapePluginAPI = {

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
    const countryMetadata = await shapePluginAPI.getCountryMetadata(dataSourceName);
    return generateUrlMetadata(dataSourceName, countries, adminLevels, countryMetadata);
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

  calculateSelectionStats: async (urlMetadata: UrlMetadata[]): Promise<SelectionStats> => {
    return calculateSelectionStats(urlMetadata);
  },

  // ===================================
  // DraftTypes-based Batch Processing
  // ===================================

  startBatchProcessing: async (
    draftId: NodeId,
    config: ProcessingConfig,
    urlMetadata: UrlMetadata[],
    progressCallback?: (event: ShapeBatchProgressEvent) => void,
  ): Promise<string> => {
    const validation = validateProcessingConfig(config);
    if (!validation.isValid) {
      throw new Error(`Invalid processing config: ${validation.errors?.join(', ')}`);
    }

    // Get draft to find the associated nodeId
    const handler = getShapeEntityHandler();
    const draftLike = await handler.getEntity(draftId) as DraftLike;
    if (!draftLike) {
      throw new Error(`Working copy not found: ${draftId}`);
    }

    // Convert ProcessingConfig to BatchConfig (legacy fields removed)
    const batchConfig: BatchProcessConfig = {
      corsProxyBaseURL: config.downloadConfig?.corsProxyUrl ?? '',
      dataSource:
        config.dataSource ??
        toDataSourceName(draftLike.draftData?.dataSourceName ?? 'naturalearth'),
      download: {
        concurrentDownloads: config.downloadConfig?.maxConcurrent ?? 4,
        deleteOnComplete: config.cleanupConfig?.deleteDownloadedFiles ?? false,
      },
      simplify1: {
        concurrentProcesses: config.simplificationConfig?.level1Workers ?? 2,
        enableFeatureFiltering: true,
        featureAreaThreshold: config.simplificationConfig?.areaThreshold ?? 0.5,
        minVertexCountForAreaFilter: 25,
        aspectRatioThreshold: 5,
        featureFilterMethod: config.simplificationConfig?.featureFilterMethod ?? 'hybrid',
        hybridFilterConfig: {
          quickRejectThreshold: 0.1,
          regularShapeMinRatio: 0.5,
          regularShapeMaxRatio: 2.0,
          simpleShapeVertexThreshold: 50,
          elongatedShapeCorrectionFactor: 0.8,
        },
        deleteOnComplete: false,
      },
      simplify2: {
        concurrentProcesses: config.simplificationConfig?.level2Workers ?? 2,
        quantize: 1e4,
        simplify: config.simplificationConfig?.tolerance ?? 0.01,
        tolerance: config.simplificationConfig?.tolerance ?? 0.1,
        enablePerFeatureSimplification: true,
        deleteOnComplete: false,
      },
      vectorTiles: {
        concurrentProcesses: config.tileConfig?.workers ?? 2,
        maxZoom: config.tileConfig?.maxZoom ?? 14,
        tileCountThresholdForZoomStop: 5000,
      },
    };

    const batchSessionData = { urlMetadata };

    // Start batch session using unified manager
    const managerWithPrepare = batchSessionManager as unknown as {
      prepareSession?: (nodeId: NodeId, config: BatchProcessConfig, data: typeof batchSessionData) => void;
    };
    const nodeForSession = draftLike.nodeId ?? draftLike.treeNodeId ?? draftId;
    managerWithPrepare.prepareSession?.(nodeForSession, batchConfig, batchSessionData);
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

    await batchManagerWithDispatch.dispatchCommand?.('session/pause', {
      sessionId: batchSessionId,
    });
  },

  resumeBatchProcessing: async (draftId: NodeId): Promise<string> => {
    const handler = getShapeEntityHandler();
    const entity = await handler.getEntity(draftId);
    const batchSessionId = getBatchSessionIdFromDraft(entity as DraftLike | undefined);
    if (!entity || !batchSessionId) {
      throw new Error(`No batch session to resume for draft: ${draftId}`);
    }

    await batchManagerWithDispatch.dispatchCommand?.('session/resume', {
      sessionId: batchSessionId,
    });
    return batchSessionId;
  },

  cancelBatchProcessing: async (draftId: NodeId): Promise<void> => {
    const handler = getShapeEntityHandler();
    const entity = await handler.getEntity(draftId);
    const batchSessionId = getBatchSessionIdFromDraft(entity as DraftLike | undefined);
    if (!entity || !batchSessionId) {
      throw new Error(`No active batch session for draft: ${draftId}`);
    }

    await batchManagerWithDispatch.dispatchCommand?.('session/cancel', {
      sessionId: batchSessionId,
    });
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
    await batchManagerWithDispatch.dispatchCommand?.(command, payload);
  },

  getBatchSession: async (sessionId: string): Promise<BatchSession | undefined> => {
    try {
      const status = await batchSessionManager.getBatchSessionStatus(sessionId);
      const nodeId = status.nodeId as NodeId;
      const handler = getShapeEntityHandler();
      const entity = await handler.getEntity(nodeId);
      const config = mergeProcessingConfig(entity?.processingConfig ?? DEFAULT_PROCESSING_CONFIG);
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
      console.warn('[shapePluginAPI] failed to fetch batch session', error);
      return undefined;
    }
  },

  getBatchTasks: async (_sessionId: string): Promise<BatchTask[]> => {
    console.warn('[shapePluginAPI] getBatchTasks not implemented in worker; returning empty list');
    return [];
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
      console.warn('[shapePluginAPI] failed to fetch batch status', error);
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
    console.log(`Getting processed feature count for node: ${nodeId}`);
    return 0;
  },

  getVectorTileInfo: async (
    nodeId: NodeId,
    z: number,
    x: number,
    y: number,
  ): Promise<TileInfo | undefined> => {
    console.log(`Getting vector tile info for node: ${nodeId}, z: ${z}, x: ${x}, y: ${y}`);
    return undefined;
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
      const session = await shapePluginAPI.getBatchSession(entity.batchSessionId);
      if (session) {
        return {
          status: session.status === 'running'
            ? 'processing'
            : session.status === 'completed'
              ? 'completed'
              : session.status === 'failed'
                ? 'failed'
                : 'idle',
          lastProcessed: session.updatedAt,
          hasErrors: session.status === 'failed',
          errorMessages: session.status === 'failed' ? ['Batch processing failed'] : [],
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
    console.log(`Cleaning up processing data for node: ${nodeId}`);
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
