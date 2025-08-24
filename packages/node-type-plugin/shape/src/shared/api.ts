/**
 * Shape API interface - UI-Worker通信契約
 */

import { NodeId, EntityId } from '@hierarchidb/common-core';
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
  ProgressInfo
} from './types';

/**
 * Main Shape API interface for UI-Worker communication via PluginRegistry
 */
export interface ShapeAPI {
  // Core shape entity operations
  createEntity(nodeId: NodeId, data: CreateShapeData): Promise<ShapeEntity>;
  getEntity(nodeId: NodeId): Promise<ShapeEntity | undefined>;
  updateEntity(nodeId: NodeId, data: UpdateShapeData): Promise<void>;
  deleteEntity(nodeId: NodeId): Promise<void>;

  // ✅ WorkingCopy management (CopyOnWrite pattern)
  createWorkingCopy(nodeId: NodeId): Promise<EntityId>;
  createNewDraftWorkingCopy(parentNodeId: NodeId): Promise<EntityId>;
  getWorkingCopy(workingCopyId: EntityId): Promise<ShapeEntity | undefined>;
  updateWorkingCopy(workingCopyId: EntityId, data: Partial<ShapeEntity>): Promise<void>;
  commitWorkingCopy(workingCopyId: EntityId): Promise<void>;
  discardWorkingCopy(workingCopyId: EntityId): Promise<void>;

  // Data source operations
  getDataSourceConfigs(): Promise<DataSourceConfig[]>;
  getCountryMetadata(dataSource: string): Promise<CountryMetadata[]>;
  generateUrlMetadata(dataSource: string, countries: string[], adminLevels: number[]): Promise<UrlMetadata[]>;

  // Selection validation
  validateSelection(countries: string[], adminLevels: number[], dataSource: string): Promise<ValidationResult>;
  calculateSelectionStats(urlMetadata: UrlMetadata[]): Promise<SelectionStats>;

  // ✅ Batch processing operations - WorkingCopy-based
  startBatchProcessing(workingCopyId: EntityId, config: ProcessingConfig, urlMetadata: UrlMetadata[]): Promise<string>;
  pauseBatchProcessing(workingCopyId: EntityId): Promise<void>;
  resumeBatchProcessing(workingCopyId: EntityId): Promise<void>;
  cancelBatchProcessing(workingCopyId: EntityId): Promise<void>;
  getBatchSession(sessionId: string): Promise<BatchSession | undefined>;
  getBatchTasks(sessionId: string): Promise<BatchTask[]>;
  getBatchProgress(workingCopyId: EntityId): Promise<ProgressInfo>;

  // ✅ Batch session recovery for direct link access
  findPendingBatchSessions(nodeId: NodeId): Promise<BatchSession[]>;
  getBatchSessionStatus(sessionId: string): Promise<{
    exists: boolean;
    canResume: boolean;
    lastActivity: number;
    expiresAt: number;
  }>;

  // Feature data access
  getProcessedFeatureCount(nodeId: NodeId): Promise<number>;
  getVectorTileInfo(nodeId: NodeId, z: number, x: number, y: number): Promise<TileInfo | undefined>;

  // Status and monitoring
  getProcessingStatus(nodeId: NodeId): Promise<ProcessingStatus>;
  cleanupProcessingData(nodeId: NodeId): Promise<void>;
}

/**
 * Processing status types
 */
export interface ProcessingStatus {
  status: 'idle' | 'processing' | 'completed' | 'failed';
  lastProcessed?: number;
  totalFeatures?: number;
  totalVectorTiles?: number;
  storageUsed?: number;
  hasErrors: boolean;
  errorMessages: string[];
}

/**
 * Tile information
 */
export interface TileInfo {
  exists: boolean;
  size: number;
  features: number;
  layers: string[];
  generatedAt: number;
  lastAccessed?: number;
}



