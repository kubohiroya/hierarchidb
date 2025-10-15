/**
 * Worker API implementation for Shape plugin
 * Implements ShapeAPI interface from shared layer
 */

import {
  type BatchSession,
  type BatchTask,
  calculateSelectionStats,
  type CountryMetadata,
  type CreateShapeData,
  type DataSourceConfig,
  type DataSourceName,
  DEFAULT_DATA_SOURCES,
  generateUrlMetadata,
  type NodeId,
  type ProcessingConfig,
  type ProcessingStatus,
  type BatchProgressEvent,
  type ShapeBatchCommand,
  type ShapeBatchCommandPayload,
  type ShapeBatchCommandMap,
  type ProgressInfo,
  type SelectionStats,
  type ShapeEntity,
  type TileInfo,
  type UpdateShapeData,
  type UrlMetadata,
  validateProcessingConfig,
  type ValidationResult,
} from '../shared/index.js';
import { ShapeEntityHandler } from './handlers/index.js';

import { metadataLoader } from '../services/metadata/MetadataLoader.js';
import { createShapeBatchManager } from '../services/batch/UnifiedShapeBatchManager.js';
import type { BatchProcessConfig } from '../services/batch/types.js';
import { getEphemeralShapeDB } from '../services/database/EphemeralShapeDB.js';
import type { TreeNodeId } from '@hierarchidb/common-types';
import type { BatchStage, BatchTaskStatus } from '../common/types/BatchTaskLike.js';
import { createComlinkEventBridge, type RemoteEventListener } from 'packages/runtime/client';
import type { StandardProgressEvent } from '@hierarchidb/runtime-shared-batch-processor';

// Create singleton unified batch manager
const batchSessionManager = createShapeBatchManager();

interface ProgressSubscription {
  proxy: RemoteEventListener<ProgressInfo>;
  unsubscribe?: () => void;
}

interface ProgressSessionMeta {
  treeNodeId?: TreeNodeId;
}

const progressCallbacks = new Map<string, ProgressSubscription>();
const progressSessionMeta = new Map<string, ProgressSessionMeta>();

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

const mapProgressToStatus = (progress: ProgressInfo): BatchTaskStatus => {
  if (progress.failed > 0) return 'failed';
  if (progress.total > 0 && progress.completed >= progress.total) return 'completed';
  return 'running';
};

const buildBatchProgressEvent = (
  sessionId: string,
  progress: ProgressInfo,
  meta: ProgressSessionMeta,
): BatchProgressEvent => {
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

const standardToProgressInfo = (event: StandardProgressEvent): ProgressInfo => ({
  total: event.total,
  completed: event.completed,
  failed: event.failed,
  skipped: Math.max(event.total - event.completed - event.failed, 0),
  percentage: event.percentage,
  currentStage: event.stage,
  currentTask: event.currentTask,
});

const hydrateSessionMeta = async (sessionId: string): Promise<void> => {
  const meta = getOrCreateSessionMeta(sessionId);
  if (meta.treeNodeId) return;
  try {
    const db = getEphemeralShapeDB();
    const record = await db.sessions.get(sessionId);
    if (record?.nodeId) {
      meta.treeNodeId = record.nodeId as TreeNodeId;
    }
  } catch (error) {
    console.warn('[shapePluginAPI] Failed to hydrate session metadata', error);
  }
};

export const shapePluginAPI = {
  // ===================================
  // Core Entity Operations
  // ===================================

  createEntity: async (nodeId: NodeId, data: CreateShapeData): Promise<ShapeEntity> => {
    const handler = new ShapeEntityHandler();
    return await handler.createEntity(nodeId, data);
  },

  getEntity: async (nodeId: NodeId): Promise<ShapeEntity | undefined> => {
    const handler = new ShapeEntityHandler();
    return (await handler.getEntityByNodeId(nodeId)) ?? undefined;
  },

  updateEntity: async (nodeId: NodeId, data: UpdateShapeData): Promise<void> => {
    const handler = new ShapeEntityHandler();
    const entity = await handler.getEntityByNodeId(nodeId);
    if (!entity) {
      throw new Error(`Shape entity not found for node: ${nodeId}`);
    }
    await handler.updateEntity(entity.id, data);
  },

  deleteEntity: async (nodeId: NodeId): Promise<void> => {
    const handler = new ShapeEntityHandler();
    const entity = await handler.getEntityByNodeId(nodeId);
    if (!entity) {
      throw new Error(`Shape entity not found for node: ${nodeId}`);
    }
    await handler.deleteEntity(entity.id);
  },

  // ===================================
  // WorkingCopyTypes Management (CopyOnWrite)
  // ===================================

  createWorkingCopy: async (nodeId: NodeId): Promise<NodeId> => {
    const handler = new ShapeEntityHandler();
    const entity = await handler.getEntityByNodeId(nodeId);
    if (!entity) {
      throw new Error(`Shape entity not found for node: ${nodeId}`);
    }
    const workingCopy = await handler.createWorkingCopy(entity);
    return workingCopy.id;
  },

  createNewDraftWorkingCopy: async (parentId: NodeId): Promise<NodeId> => {
    const handler = new ShapeEntityHandler();
    const workingCopy = await handler.createNewDraftWorkingCopy(parentId);
    return workingCopy.id;
  },

  getWorkingCopy: async (workingCopyId: NodeId): Promise<ShapeEntity | undefined> => {
    const handler = new ShapeEntityHandler();
    return await handler.getWorkingCopy(workingCopyId);
  },

  updateWorkingCopy: async (workingCopyId: NodeId, data: Partial<ShapeEntity>): Promise<void> => {
    const handler = new ShapeEntityHandler();
    await handler.updateWorkingCopy(workingCopyId, data);
  },

  commitWorkingCopy: async (workingCopyId: NodeId): Promise<NodeId> => {
    const handler = new ShapeEntityHandler();
    return await handler.commitWorkingCopy(workingCopyId);
  },

  discardWorkingCopy: async (workingCopyId: NodeId): Promise<void> => {
    const handler = new ShapeEntityHandler();
    await handler.discardWorkingCopy(workingCopyId);
  },

  // ===================================
  // Data Source Operations
  // ===================================

  getDataSourceConfigs: async (): Promise<DataSourceConfig[]> => {
    return DEFAULT_DATA_SOURCES;
  },

  getCountryMetadata: async (dataSource: string | DataSourceName): Promise<CountryMetadata[]> => {
    // Load from pre-fetched metadata files provided by @hierarchidb/runtime-shared-fetch-save-metadata
    // Use the centralized MetadataLoader service for caching and transformation
    try {
      const data = await metadataLoader.loadMetadata(toDataSourceName(dataSource));
      if (Array.isArray(data) && data.length > 0) return data;
    } catch (err) {
      console.error('Failed to load country metadata for data source:', dataSource, err);
    }
    // Fallback minimal metadata for tests/offline
    return [
      { countryCode: 'US', countryName: 'United States', availableAdminLevels: [0, 1, 2] },
      { countryCode: 'JP', countryName: 'Japan', availableAdminLevels: [0, 1, 2] },
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
  ): Promise<ValidationResult> => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const dataSourceName = toDataSourceName(dataSource);

    if (countries.length === 0) {
      errors.push('At least one country must be selected');
    }

    if (adminLevels.length === 0) {
      errors.push('At least one administrative level must be selected');
    }

    if (!DEFAULT_DATA_SOURCES.find((ds) => ds.name === dataSourceName)) {
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
  // WorkingCopyTypes-based Batch Processing
  // ===================================

  startBatchProcessing: async (
    workingCopyId: NodeId,
    config: ProcessingConfig,
    urlMetadata: UrlMetadata[],
    progressCallback?: (event: BatchProgressEvent) => void,
  ): Promise<string> => {
    const validation = validateProcessingConfig(config);
    if (!validation.isValid) {
      throw new Error(`Invalid processing config: ${validation.errors?.join(', ')}`);
    }

    // Get working copy to find the associated nodeId
    const handler = new ShapeEntityHandler();
    const workingCopy = await handler.getWorkingCopy(workingCopyId);
    if (!workingCopy) {
      throw new Error(`Working copy not found: ${workingCopyId}`);
    }

    // Convert ProcessingConfig to BatchConfig
    const batchConfig: BatchProcessConfig = {
      corsProxyBaseURL: config.downloadConfig?.corsProxyUrl ?? '',
      dataSource: config.dataSource,
      download: {
        concurrentDownloads: config.downloadConfig?.maxConcurrent ?? 4,
        deleteOnComplete: config.cleanupConfig?.deleteDownloadedFiles ?? false,
      },
      simplify1: {
        concurrentProcesses: config.simplificationConfig?.level1Workers ?? 2,
        enableFeatureFiltering: config.simplificationConfig?.enableFiltering ?? true,
        featureAreaThreshold: config.simplificationConfig?.areaThreshold ?? 0.5,
        minVertexCountForAreaFilter: 25,
        aspectRatioThreshold: 5,
        featureFilterMethod: 'hybrid',
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
        tolerance: 0.1,
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
    managerWithPrepare.prepareSession?.(workingCopy.nodeId, batchConfig, batchSessionData);
    const sessionId = await batchSessionManager.startBatchSession(workingCopy.nodeId);

    const sessionMeta = getOrCreateSessionMeta(sessionId);
    sessionMeta.treeNodeId = workingCopy.nodeId as TreeNodeId;

    // Register progress callback if provided
    if (progressCallback) {
      const bridge = createComlinkEventBridge<BatchProgressEvent, ProgressInfo, StandardProgressEvent>({
        runtimeToUi: (progress) => buildBatchProgressEvent(sessionId, progress, sessionMeta),
        workerToRuntime: standardToProgressInfo,
      });
      const proxiedCallback = bridge.createUiProxy(progressCallback);
      const runtimeListener = bridge.toRuntimeListener(proxiedCallback);
      const existing = progressCallbacks.get(sessionId);
      existing?.unsubscribe?.();
      const unsubscribe = batchSessionManager.onBatchProgress(sessionId, runtimeListener);
      progressCallbacks.set(sessionId, { proxy: proxiedCallback, unsubscribe });
    }

    // Save session ID to working copy
    await handler.updateWorkingCopy(workingCopyId, {
      batchSessionId: sessionId,
    });

    return sessionId;
  },

  pauseBatchProcessing: async (workingCopyId: NodeId): Promise<void> => {
    const handler = new ShapeEntityHandler();
    const workingCopy = await handler.getWorkingCopy(workingCopyId);
    if (!workingCopy || !workingCopy.batchSessionId) {
      throw new Error(`No active batch session for working copy: ${workingCopyId}`);
    }

    await batchSessionManager.dispatchCommand('session/pause', {
      sessionId: workingCopy.batchSessionId,
    });
  },

  resumeBatchProcessing: async (workingCopyId: NodeId): Promise<string> => {
    const handler = new ShapeEntityHandler();
    const workingCopy = await handler.getWorkingCopy(workingCopyId);
    if (!workingCopy || !workingCopy.batchSessionId) {
      throw new Error(`No batch session to resume for working copy: ${workingCopyId}`);
    }

    await batchSessionManager.dispatchCommand('session/resume', {
      sessionId: workingCopy.batchSessionId,
    });
    return workingCopy.batchSessionId;
  },

  cancelBatchProcessing: async (workingCopyId: NodeId): Promise<void> => {
    const handler = new ShapeEntityHandler();
    const workingCopy = await handler.getWorkingCopy(workingCopyId);
    if (!workingCopy || !workingCopy.batchSessionId) {
      throw new Error(`No active batch session for working copy: ${workingCopyId}`);
    }

    await batchSessionManager.dispatchCommand('session/cancel', {
      sessionId: workingCopy.batchSessionId,
    });
    const subscription = progressCallbacks.get(workingCopy.batchSessionId);
    subscription?.unsubscribe?.();
    progressCallbacks.delete(workingCopy.batchSessionId);
    progressSessionMeta.delete(workingCopy.batchSessionId);

    // Clear session ID from working copy
    await handler.updateWorkingCopy(workingCopyId, {
      batchSessionId: undefined,
    });
  },

  invokeBatchCommand: async <K extends ShapeBatchCommand>(
    command: K,
    payload: ShapeBatchCommandPayload<K>,
  ): Promise<void> => {
    await batchSessionManager.dispatchCommand(command, payload);
  },

  getBatchSession: async (sessionId: string): Promise<BatchSession | undefined> => {
    const ephemeralDB = getEphemeralShapeDB();
    const session = await ephemeralDB.sessions.get(sessionId);

    if (!session) {
      return undefined;
    }

    return {
      sessionId: session.id,
      workingCopyId: session.nodeId,
      status: session.status,
      progress: session.progress,
      stage: session.stage,
      startTime: session.startTime,
      endTime: session.endTime,
      config: session.config,
      totalTasks: session.totalTasks,
      completedTasks: session.completedTasks,
      failedTasks: session.failedTasks,
      error: session.error,
    };
  },

  getBatchTasks: async (sessionId: string): Promise<BatchTask[]> => {
    const ephemeralDB = getEphemeralShapeDB();
    const tasks = await ephemeralDB.tasks.where('sessionId').equals(sessionId).toArray();

    return tasks.map(task => ({
      id: task.id,
      sessionId: task.sessionId,
      stage: task.stage,
      url: task.urlString,
      status: task.status,
      progress: task.progress || 0,
      error: task.error,
      startTime: task.startTime,
      endTime: task.endTime,
      retryCount: task.retryCount || 0,
      metadata: {
        adminLevel: task.adminLevel,
        countryCode: task.countryCode,
      },
    }));
  },

  getBatchProgress: async (workingCopyId: NodeId): Promise<ProgressInfo> => {
    const handler = new ShapeEntityHandler();
    const workingCopy = await handler.getWorkingCopy(workingCopyId);
    if (!workingCopy || !workingCopy.batchSessionId) {
      return {
        total: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 0,
      };
    }

    const session = await shapePluginAPI.getBatchSession(workingCopy.batchSessionId);
    if (!session) {
      return {
        total: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
        percentage: 0,
      };
    }

    return {
      total: session.totalTasks || 0,
      completed: session.completedTasks || 0,
      failed: session.failedTasks || 0,
      skipped: 0,
      percentage: session.progress || 0,
      currentStage: session.stage,
    };
  },

  getBatchStatus: async (
    sessionId: string,
  ): Promise<{
    sessionId: string;
    workingCopyId?: NodeId;
    status: string;
    progress?: number;
    completedTasks?: number;
    totalTasks?: number;
  }> => {
    console.log(`Getting batch status for session: ${sessionId}`);
    return {
      sessionId,
      status: 'running',
      progress: 0.5,
      completedTasks: 0,
      totalTasks: 0,
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
    sessionId: string,
  ): Promise<{
    exists: boolean;
    canResume: boolean;
    lastActivity: number;
    expiresAt: number;
  }> => {
    console.log(`Getting batch session status: ${sessionId}`);
    return {
      exists: false,
      canResume: false,
      lastActivity: 0,
      expiresAt: 0,
    };
  },

  // ===================================
  // EphemeralDB Cleanup
  // ===================================

  performCleanup: async (): Promise<{
    workingCopiesRemoved: number;
    batchSessionsRemoved: number;
    totalSpaceRecovered: number;
    timestamp: number;
  }> => {
    console.log('Performing EphemeralDB cleanup');
    return {
      workingCopiesRemoved: 0,
      batchSessionsRemoved: 0,
      totalSpaceRecovered: 0,
      timestamp: Date.now(),
    };
  },

  getCleanupStats: async (): Promise<{
    totalWorkingCopies: number;
    expiredWorkingCopies: number;
    totalBatchSessions: number;
    expiredBatchSessions: number;
    estimatedSpaceUsed: number;
    lastCleanupAt?: number;
  }> => {
    console.log('Getting cleanup statistics');
    return {
      totalWorkingCopies: 0,
      expiredWorkingCopies: 0,
      totalBatchSessions: 0,
      expiredBatchSessions: 0,
      estimatedSpaceUsed: 0,
      lastCleanupAt: Date.now(),
    };
  },

  // ===================================
  // Real-time Progress Subscription
  // ===================================

  subscribeToProgress: (sessionId: string, callback: (event: BatchProgressEvent) => void): (() => void) => {
    const sessionMeta = getOrCreateSessionMeta(sessionId);
    if (!sessionMeta.treeNodeId) {
      void hydrateSessionMeta(sessionId);
    }

    const bridge = createComlinkEventBridge<BatchProgressEvent, ProgressInfo, StandardProgressEvent>({
      runtimeToUi: (progress) => buildBatchProgressEvent(sessionId, progress, sessionMeta),
      workerToRuntime: standardToProgressInfo,
    });
    const proxiedCallback = bridge.createUiProxy(callback);
    const runtimeListener = bridge.toRuntimeListener(proxiedCallback);
    const existing = progressCallbacks.get(sessionId);
    existing?.unsubscribe?.();
    const unsubscribe = batchSessionManager.onBatchProgress(sessionId, runtimeListener);
    progressCallbacks.set(sessionId, { proxy: proxiedCallback, unsubscribe });

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
    console.log('Force cleaning all EphemeralDB data');
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
    const handler = new ShapeEntityHandler();
    const entity = await handler.getEntityByNodeId(nodeId);
    if (!entity) return { status: 'idle', hasErrors: false, errorMessages: [] };

    // Try to reflect batch session status if available
    if (entity.batchSessionId) {
      const session = await shapePluginAPI.getBatchSession(entity.batchSessionId);
      if (session) {
        return {
          status: session.status === 'running' ? 'processing' : (session.status === 'completed' ? 'completed' : (session.status === 'failed' ? 'failed' : 'idle')),
          lastProcessed: session.updatedAt,
          hasErrors: !!session.error,
          errorMessages: session.error ? [String(session.error)] : [],
          // Optionally map aggregates if available
          totalFeatures: undefined,
          totalVectorTiles: undefined,
          storageUsed: undefined,
        };
      }
    }

    return {
      status: entity.processingStatus || 'idle',
      lastProcessed: entity.updatedAt,
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
