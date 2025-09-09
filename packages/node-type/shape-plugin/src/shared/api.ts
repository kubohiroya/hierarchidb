/**
  * Shape API interface - UI-Worker
  */

import type { NodeId } from './types';
import {
  BatchSession,
  BatchTask,
  CountryMetadata,
  CreateShapeData,
  DataSourceConfig,
  ProcessingConfig,
  ProgressInfo,
  SelectionStats,
  ShapeEntity,
  UpdateShapeData,
  UrlMetadata,
  ValidationResult,
} from './types';

/**
 * Main Shape API interface for UI-Worker communication via PluginRegistryImpl
 */
export interface ShapeAPI {
  // Core shape-plugin entity operations
  createEntity(nodeId: NodeId, data: CreateShapeData): Promise<ShapeEntity>;

  getEntity(nodeId: NodeId): Promise<ShapeEntity | undefined>;

  updateEntity(nodeId: NodeId, data: UpdateShapeData): Promise<void>;

  deleteEntity(nodeId: NodeId): Promise<void>;

  //  WorkingCopyTypes management (CopyOnWrite pattern)
  createWorkingCopy(nodeId: NodeId): Promise<NodeId>;

  createNewDraftWorkingCopy(parentId: NodeId): Promise<NodeId>;

  getWorkingCopy(workingCopyId: NodeId): Promise<ShapeEntity | undefined>;

  updateWorkingCopy(workingCopyId: NodeId, data: Partial<ShapeEntity>): Promise<void>;

  commitWorkingCopy(workingCopyId: NodeId): Promise<void>;

  discardWorkingCopy(workingCopyId: NodeId): Promise<void>;

  // Data source operations
  getDataSourceConfigs(): Promise<DataSourceConfig[]>;

  getCountryMetadata(dataSource: string): Promise<CountryMetadata[]>;

  generateUrlMetadata(
    dataSource: string,
    countries: string[],
    adminLevels: number[],
  ): Promise<UrlMetadata[]>;

  // Selection validation
  validateSelection(
    countries: string[],
    adminLevels: number[],
    dataSource: string,
  ): Promise<ValidationResult>;

  calculateSelectionStats(urlMetadata: UrlMetadata[]): Promise<SelectionStats>;

  //  Batch processing operations - WorkingCopyTypes-based
  startBatchProcessing(
    workingCopyId: NodeId,
    config: ProcessingConfig,
    urlMetadata: UrlMetadata[],
  ): Promise<string>;

  pauseBatchProcessing(workingCopyId: NodeId): Promise<void>;

  resumeBatchProcessing(workingCopyId: NodeId): Promise<void>;

  cancelBatchProcessing(workingCopyId: NodeId): Promise<void>;

  getBatchSession(sessionId: string): Promise<BatchSession | undefined>;

  getBatchTasks(sessionId: string): Promise<BatchTask[]>;

  getBatchProgress(workingCopyId: NodeId): Promise<ProgressInfo>;

  //  Batch session recovery for direct link access
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
  status: 'idle' | 'processing' | 'completed' | 'failed' | 'cancelled';
  lastProcessed?: number;
  totalFeatures?: number;
  totalVectorTiles?: number;
  storageUsed?: number;
  hasErrors: boolean;
  errorMessages: string[];
  // Optional fields used by UI hooks/components
  stage?: string;
  progress?: number;
  lastUpdated?: number;
  error?: string;
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
