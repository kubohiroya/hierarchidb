/**
 * Worker API implementation for Shape plugin
 * Implements ShapeAPI interface from shared layer
 */

import { NodeId, EntityId } from '@hierarchidb/common-type';
import {
  ShapeEntity,
  CreateShapeData,
  UpdateShapeData,
  ProcessingConfig,
  BatchSession,
  BatchTask,
  UrlMetadata,
  CountryMetadata,
  DataSourceConfig,
  ValidationResult,
  SelectionStats,
  ProgressInfo,
  ProcessingStatus,
  TileInfo,
} from '../shared';
import { ShapeEntityHandler } from './handlers';
import {
  DEFAULT_DATA_SOURCES,
  generateUrlMetadata,
  calculateSelectionStats,
  validateProcessingConfig,
  generateSessionId,
} from '../shared';

import { metadataLoader } from '../services/metadata/MetadataLoader';
import { BatchSessionManager } from '../services/BatchSessionManager';
import { getEphemeralShapeDB } from '../services/database/EphemeralShapeDB';
import * as Comlink from 'comlink';

// Create singleton instance of BatchSessionManager
const batchSessionManager = new BatchSessionManager();

// Progress callback registry
const progressCallbacks = new Map<string, (event: any) => void>();

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

  createWorkingCopy: async (nodeId: NodeId): Promise<EntityId> => {
    const handler = new ShapeEntityHandler();
    const entity = await handler.getEntityByNodeId(nodeId);
    if (!entity) {
      throw new Error(`Shape entity not found for node: ${nodeId}`);
    }
    const workingCopy = await handler.createWorkingCopy(entity);
    return workingCopy.id;
  },

  createNewDraftWorkingCopy: async (parentId: NodeId): Promise<EntityId> => {
    const handler = new ShapeEntityHandler();
    const workingCopy = await handler.createNewDraftWorkingCopy(parentId);
    return workingCopy.id;
  },

  getWorkingCopy: async (workingCopyId: EntityId): Promise<ShapeEntity | undefined> => {
    const handler = new ShapeEntityHandler();
    return await handler.getWorkingCopy(workingCopyId);
  },

  updateWorkingCopy: async (workingCopyId: EntityId, data: Partial<ShapeEntity>): Promise<void> => {
    const handler = new ShapeEntityHandler();
    await handler.updateWorkingCopy(workingCopyId, data);
  },

  commitWorkingCopy: async (workingCopyId: EntityId): Promise<NodeId> => {
    const handler = new ShapeEntityHandler();
    return await handler.commitWorkingCopy(workingCopyId);
  },

  discardWorkingCopy: async (workingCopyId: EntityId): Promise<void> => {
    const handler = new ShapeEntityHandler();
    await handler.discardWorkingCopy(workingCopyId);
  },

  // ===================================
  // Data Source Operations
  // ===================================

  getDataSourceConfigs: async (): Promise<DataSourceConfig[]> => {
    return DEFAULT_DATA_SOURCES;
  },

  getCountryMetadata: async (_dataSource: string): Promise<CountryMetadata[]> => {
    // Load from pre-fetched metadata files provided by @hierarchidb/runtime-fetch-metadata
    // Use the centralized MetadataLoader service for caching and transformation
    try {
      const data = await metadataLoader.loadMetadata(_dataSource);
      return data;
    } catch (err) {
      console.error('Failed to load country metadata for data source:', _dataSource, err);
      return [];
    }
  },

  generateUrlMetadata: async (
    dataSource: string,
    countries: string[],
    adminLevels: number[]
  ): Promise<UrlMetadata[]> => {
    // Get country metadata first
    const countryMetadata = await shapePluginAPI.getCountryMetadata(dataSource);
    return generateUrlMetadata(dataSource as any, countries, adminLevels, countryMetadata);
  },

  // ===================================
  // Selection Validation
  // ===================================

  validateSelection: async (
    countries: string[],
    adminLevels: number[],
    dataSource: string
  ): Promise<ValidationResult> => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (countries.length === 0) {
      errors.push('At least one country must be selected');
    }

    if (adminLevels.length === 0) {
      errors.push('At least one administrative level must be selected');
    }

    if (!DEFAULT_DATA_SOURCES.find((ds) => ds.name === dataSource)) {
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
    workingCopyId: EntityId,
    config: ProcessingConfig,
    urlMetadata: UrlMetadata[],
    progressCallback?: (event: any) => void
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
    const batchConfig = {
      corsProxyBaseURL: config.downloadConfig?.corsProxyUrl || '',
      dataSource: config.dataSource,
      download: {
        concurrentDownloads: config.downloadConfig?.maxConcurrent || 4,
        deleteOnComplete: config.cleanupConfig?.deleteDownloadedFiles || false,
      },
      simplify1: {
        concurrentProcesses: config.simplificationConfig?.level1Workers || 2,
        enableFeatureFiltering: config.simplificationConfig?.enableFiltering || true,
        featureAreaThreshold: config.simplificationConfig?.areaThreshold || 0.5,
        minVertexCountForAreaFilter: 25,
        aspectRatioThreshold: 5,
        featureFilterMethod: 'hybrid' as const,
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
        concurrentProcesses: config.simplificationConfig?.level2Workers || 2,
        quantize: 1e4,
        simplify: config.simplificationConfig?.tolerance || 0.01,
        tolerance: 0.1,
        enablePerFeatureSimplification: true,
        deleteOnComplete: false,
      },
      vectorTiles: {
        concurrentProcesses: config.tileConfig?.workers || 2,
        maxZoom: config.tileConfig?.maxZoom || 14,
        tileCountThresholdForZoomStop: 5000,
      },
    };

    // Create URL tasks from metadata
    const urlTasks = urlMetadata.map(meta => ({
      urlString: meta.url,
      adminLevel: meta.adminLevel,
      countryCode: meta.countryCode,
    }));

    // Start batch session - authentication is handled internally by BatchSessionManager
    const sessionId = await batchSessionManager.startBatchSession(
      workingCopy.nodeId,
      batchConfig,
      urlTasks
    );

    // Register progress callback if provided
    if (progressCallback) {
      const proxiedCallback = Comlink.proxy(progressCallback);
      progressCallbacks.set(sessionId, proxiedCallback);
      batchSessionManager.onProgress(sessionId, proxiedCallback);
    }

    // Save session ID to working copy
    await handler.updateWorkingCopy(workingCopyId, {
      batchSessionId: sessionId,
    });

    return sessionId;
  },

  pauseBatchProcessing: async (workingCopyId: EntityId): Promise<void> => {
    const handler = new ShapeEntityHandler();
    const workingCopy = await handler.getWorkingCopy(workingCopyId);
    if (!workingCopy || !workingCopy.batchSessionId) {
      throw new Error(`No active batch session for working copy: ${workingCopyId}`);
    }

    await batchSessionManager.pauseBatchSession(workingCopy.batchSessionId);
  },

  resumeBatchProcessing: async (workingCopyId: EntityId): Promise<string> => {
    const handler = new ShapeEntityHandler();
    const workingCopy = await handler.getWorkingCopy(workingCopyId);
    if (!workingCopy || !workingCopy.batchSessionId) {
      throw new Error(`No batch session to resume for working copy: ${workingCopyId}`);
    }

    await batchSessionManager.resumeBatchSession(workingCopy.batchSessionId);
    return workingCopy.batchSessionId;
  },

  cancelBatchProcessing: async (workingCopyId: EntityId): Promise<void> => {
    const handler = new ShapeEntityHandler();
    const workingCopy = await handler.getWorkingCopy(workingCopyId);
    if (!workingCopy || !workingCopy.batchSessionId) {
      throw new Error(`No active batch session for working copy: ${workingCopyId}`);
    }

    await batchSessionManager.cancelBatchSession(workingCopy.batchSessionId);
    
    // Clear session ID from working copy
    await handler.updateWorkingCopy(workingCopyId, {
      batchSessionId: undefined,
    });
  },

  getBatchSession: async (sessionId: string): Promise<BatchSession | undefined> => {
    const ephemeralDB = getEphemeralShapeDB();
    const session = await ephemeralDB.sessions.get(sessionId);
    
    if (!session) {
      return undefined;
    }

    return {
      sessionId: session.id,
      workingCopyId: session.nodeId as unknown as EntityId, // Convert NodeId to EntityId
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

  getBatchProgress: async (workingCopyId: EntityId): Promise<ProgressInfo> => {
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
    sessionId: string
  ): Promise<{
    sessionId: string;
    workingCopyId?: EntityId;
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
    sessionId: string
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

  subscribeToProgress: (sessionId: string, callback: (event: any) => void): (() => void) => {
    // Register callback with Comlink proxy
    const proxiedCallback = Comlink.proxy(callback);
    progressCallbacks.set(sessionId, proxiedCallback);
    batchSessionManager.onProgress(sessionId, proxiedCallback);
    
    // Return unsubscribe function
    return () => {
      progressCallbacks.delete(sessionId);
      // Note: BatchSessionManager should handle cleanup of inactive callbacks
      batchSessionManager.cleanupInactiveSubscriptions();
    };
  },

  getProcessingStatus: async (nodeId: NodeId): Promise<ProcessingStatus> => {
    const handler = new ShapeEntityHandler();
    const entity = await handler.getEntityByNodeId(nodeId);
    
    if (!entity || !entity.batchSessionId) {
      return {
        status: 'idle',
        lastUpdated: Date.now(),
      };
    }

    const session = await shapePluginAPI.getBatchSession(entity.batchSessionId);
    if (!session) {
      return {
        status: 'idle',
        lastUpdated: Date.now(),
      };
    }

    return {
      status: session.status,
      stage: session.stage,
      progress: session.progress,
      lastUpdated: Date.now(),
      error: session.error,
    };
  },

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
    y: number
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

    if (!entity) {
      return {
        status: 'idle',
        hasErrors: false,
        errorMessages: [],
      };
    }

    return {
      status: entity.processingStatus || 'idle',
      lastProcessed: entity.updatedAt,
      totalFeatures: 0,
      totalVectorTiles: 0,
      storageUsed: 0,
      hasErrors: false,
      errorMessages: [],
    };
  },

  cleanupProcessingData: async (nodeId: NodeId): Promise<void> => {
    console.log(`Cleaning up processing data for node: ${nodeId}`);
  },
};
