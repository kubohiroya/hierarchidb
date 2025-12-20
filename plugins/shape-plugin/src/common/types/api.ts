/**
  * Shape API interface - UI-Worker
  */

import type { NodeId } from '@hierarchidb/common-types';

import type {
  BatchSession,
  BatchTask,
  CountryMetadata,
  DataSourceConfig,
  ProcessingConfig,
  ProgressInfo,
  ShapeBatchCommand,
  ShapeBatchCommandPayload,
  SelectionStats,
  ShapeEntity,
  UrlMetadata,
  ShapeStepValidationResult,
} from '../types/index.js';

/**
 * Main Shape API interface for UI-Worker communication via PluginRegistryImpl
 */
export interface ShapeAPI {
  //  DraftTypes management (CopyOnWrite pattern)
  createDraft(nodeId: NodeId): Promise<NodeId>;

  createNewDraftBase(parentId: NodeId): Promise<NodeId>;

  getDraft(draftId: NodeId): Promise<ShapeEntity | undefined>;

  updateDraft(draftId: NodeId, data: Partial<ShapeEntity>): Promise<void>;

  commitDraft(draftId: NodeId): Promise<void>;

  discardDraft(draftId: NodeId): Promise<void>;

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
  ): Promise<ShapeStepValidationResult>;

  calculateSelectionStats(urlMetadata: UrlMetadata[]): Promise<SelectionStats>;

  //  Batch processing operations - DraftTypes-based
  startBatchProcessing(
    draftId: NodeId,
    config: ProcessingConfig,
    urlMetadata: UrlMetadata[],
  ): Promise<string>;

  pauseBatchProcessing(draftId: NodeId): Promise<void>;

  resumeBatchProcessing(draftId: NodeId): Promise<void>;

  cancelBatchProcessing(draftId: NodeId): Promise<void>;

  invokeBatchCommand<K extends ShapeBatchCommand>(command: K, payload: ShapeBatchCommandPayload<K>): Promise<void>;

  getBatchSession(sessionId: string): Promise<BatchSession | undefined>;

  getBatchTasks(sessionId: string): Promise<BatchTask[]>;

  getBatchProgress(draftId: NodeId): Promise<ProgressInfo>;

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

  // Vector tile access by session
  listGeneratedTiles(sessionId: string): Promise<Array<{ z: number; x: number; y: number; size: number; timestamp: number }>>;
  getGeneratedTile(sessionId: string, z: number, x: number, y: number): Promise<Uint8Array | null>;
  getGeneratedTileSummary(sessionId: string): Promise<{ tiles: number; totalBytes: number; zoomMin?: number; zoomMax?: number }>;
}

/**
 * Processing status types
 */
export interface ProcessingStatus {
  status: 'idle' | 'processing' | 'paused' | 'completed' | 'failed' | 'cancelled';
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
