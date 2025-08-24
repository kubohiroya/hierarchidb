/**
 * Worker API implementation for Shape plugin
 * Implements ShapeAPI interface from shared layer
 */

import { NodeId, EntityId, generateEntityId } from "@hierarchidb/common-core";
import type { PluginAPI } from "@hierarchidb/common-api";
import {
  ShapeAPI,
  ShapeEntity,
  ShapeWorkingCopy,
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
} from "../shared";
import { DEFAULT_PROCESSING_CONFIG } from "../shared/constants";
import { ShapeEntityHandler } from "./handlers";
import {
  DEFAULT_DATA_SOURCES,
  generateUrlMetadata,
  calculateSelectionStats,
  validateProcessingConfig,
  generateSessionId,
  generateTaskId,
} from "../shared";

export const shapePluginAPI = {
  // ===================================
  // Core Entity Operations
  // ===================================

  createEntity: async (
    nodeId: NodeId,
    data: CreateShapeData,
  ): Promise<ShapeEntity> => {
    const handler = new ShapeEntityHandler();
    return await handler.createEntity(nodeId, data);
  },

  getEntity: async (nodeId: NodeId): Promise<ShapeEntity | undefined> => {
    const handler = new ShapeEntityHandler();
    return await handler.getEntityByNodeId(nodeId);
  },

  updateEntity: async (
    nodeId: NodeId,
    data: UpdateShapeData,
  ): Promise<void> => {
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
  // WorkingCopy Management (CopyOnWrite)
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

  createNewDraftWorkingCopy: async (
    parentNodeId: NodeId,
  ): Promise<EntityId> => {
    const handler = new ShapeEntityHandler();
    const workingCopy = await handler.createNewDraftWorkingCopy(parentNodeId);
    return workingCopy.id;
  },

  getWorkingCopy: async (
    workingCopyId: EntityId,
  ): Promise<ShapeEntity | undefined> => {
    const handler = new ShapeEntityHandler();
    return await handler.getWorkingCopy(workingCopyId);
  },

  updateWorkingCopy: async (
    workingCopyId: EntityId,
    data: Partial<ShapeEntity>,
  ): Promise<void> => {
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

  getCountryMetadata: async (
    dataSource: string,
  ): Promise<CountryMetadata[]> => {
    // Mock implementation - would fetch from real data source
    return [
      {
        countryCode: "US",
        countryName: "United States",
        continent: "North America",
        availableAdminLevels: [0, 1, 2],
        population: 331900000,
        area: 9833517,
        dataQuality: "high",
      },
      {
        countryCode: "JP",
        countryName: "Japan",
        continent: "Asia",
        availableAdminLevels: [0, 1],
        population: 125800000,
        area: 377975,
        dataQuality: "high",
      },
    ];
  },

  generateUrlMetadata: async (
    dataSource: string,
    countries: string[],
    adminLevels: number[],
  ): Promise<UrlMetadata[]> => {
    // Get country metadata first
    const countryMetadata = await shapePluginAPI.getCountryMetadata(dataSource);
    return generateUrlMetadata(
      dataSource as any,
      countries,
      adminLevels,
      countryMetadata,
    );
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

    if (countries.length === 0) {
      errors.push("At least one country must be selected");
    }

    if (adminLevels.length === 0) {
      errors.push("At least one administrative level must be selected");
    }

    if (!DEFAULT_DATA_SOURCES.find((ds) => ds.name === dataSource)) {
      errors.push("Invalid data source selected");
    }

    if (countries.length > 10) {
      warnings.push(
        "Large country selection may require significant processing time",
      );
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  },

  calculateSelectionStats: async (
    urlMetadata: UrlMetadata[],
  ): Promise<SelectionStats> => {
    return calculateSelectionStats(urlMetadata);
  },

  // ===================================
  // WorkingCopy-based Batch Processing
  // ===================================

  startBatchProcessing: async (
    workingCopyId: EntityId,
    config: ProcessingConfig,
    urlMetadata: UrlMetadata[],
  ): Promise<string> => {
    const validation = validateProcessingConfig(config);
    if (!validation.isValid) {
      throw new Error(
        `Invalid processing config: ${validation.errors?.join(", ")}`,
      );
    }

    const sessionId = generateSessionId();
    console.log(
      `Started batch processing session: ${sessionId} for working copy: ${workingCopyId}`,
    );
    return sessionId;
  },

  pauseBatchProcessing: async (workingCopyId: EntityId): Promise<void> => {
    console.log(`Pausing batch processing for working copy: ${workingCopyId}`);
  },

  resumeBatchProcessing: async (workingCopyId: EntityId): Promise<string> => {
    console.log(`Resuming batch processing for working copy: ${workingCopyId}`);
    return generateSessionId();
  },

  cancelBatchProcessing: async (workingCopyId: EntityId): Promise<void> => {
    console.log(
      `Cancelling batch processing for working copy: ${workingCopyId}`,
    );
  },

  getBatchSession: async (
    sessionId: string,
  ): Promise<BatchSession | undefined> => {
    console.log(`Getting batch session: ${sessionId}`);
    return undefined;
  },

  getBatchTasks: async (sessionId: string): Promise<BatchTask[]> => {
    console.log(`Getting batch tasks for session: ${sessionId}`);
    return [];
  },

  getBatchProgress: async (workingCopyId: EntityId): Promise<ProgressInfo> => {
    console.log(`Getting batch progress for working copy: ${workingCopyId}`);
    return {
      total: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      percentage: 0,
    };
  },

  getBatchStatus: async (
    sessionId: string,
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
      status: "running",
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
    console.log("Performing EphemeralDB cleanup");
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
    console.log("Getting cleanup statistics");
    return {
      totalWorkingCopies: 0,
      expiredWorkingCopies: 0,
      totalBatchSessions: 0,
      expiredBatchSessions: 0,
      estimatedSpaceUsed: 0,
      lastCleanupAt: Date.now(),
    };
  },

  forceCleanup: async (): Promise<{
    workingCopiesRemoved: number;
    batchSessionsRemoved: number;
    totalSpaceRecovered: number;
    timestamp: number;
  }> => {
    console.log("Force cleaning all EphemeralDB data");
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
    console.log(
      `Getting vector tile info for node: ${nodeId}, z: ${z}, x: ${x}, y: ${y}`,
    );
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
        status: "idle",
        hasErrors: false,
        errorMessages: [],
      };
    }

    return {
      status: entity.processingStatus || "idle",
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
