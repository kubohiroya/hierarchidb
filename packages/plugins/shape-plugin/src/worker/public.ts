// Public worker API types for @hierarchidb/plugins-shape-plugin/worker
// Keep this file type-only and decoupled from internal Dexie types

import type {
  BatchSession,
  BatchTask,
  CountryMetadata,
  CreateShapeData,
  DataSourceConfig,
  NodeId,
  ProcessingConfig,
  ProcessingStatus,
  SelectionStats,
  ShapeEntity,
  TileInfo,
  UpdateShapeData,
  UrlMetadata,
  ValidationResult,
} from '../shared/index.js';

export interface ShapeWorkerAPI {
  // Entities
  createEntity(nodeId: NodeId, data: CreateShapeData): Promise<ShapeEntity>;
  getEntity(nodeId: NodeId): Promise<ShapeEntity | undefined>;
  updateEntity(nodeId: NodeId, data: UpdateShapeData): Promise<void>;
  deleteEntity(nodeId: NodeId): Promise<void>;

  // Working copies
  createWorkingCopy(nodeId: NodeId): Promise<NodeId>;
  createNewDraftWorkingCopy(parentId: NodeId): Promise<NodeId>;
  getWorkingCopy(workingCopyId: NodeId): Promise<ShapeEntity | undefined>;
  updateWorkingCopy(workingCopyId: NodeId, data: Partial<ShapeEntity>): Promise<void>;
  commitWorkingCopy(workingCopyId: NodeId): Promise<NodeId>;
  discardWorkingCopy(workingCopyId: NodeId): Promise<void>;

  // Data sources
  getDataSourceConfigs(): Promise<DataSourceConfig[]>;
  getCountryMetadata(dataSource: string): Promise<CountryMetadata[]>;
  generateUrlMetadata(dataSource: string, countries: string[], adminLevels: number[]): Promise<UrlMetadata[]>;

  // Validation / estimation
  validateSelection(countries: string[], adminLevels: number[], dataSource: string): Promise<ValidationResult>;
  calculateSelectionStats(urlMetadata: UrlMetadata[]): Promise<SelectionStats>;

  // Batch processing (WorkingCopy-based)
  startBatchProcessing(
    workingCopyId: NodeId,
    config: ProcessingConfig,
    urlMetadata: UrlMetadata[],
    progressCallback?: (event: any) => void,
  ): Promise<string>; // returns sessionId
  pauseBatchProcessing(workingCopyId: NodeId): Promise<void>;
  resumeBatchProcessing(workingCopyId: NodeId): Promise<string>;
  cancelBatchProcessing(workingCopyId: NodeId): Promise<void>;
  getBatchSession(sessionId: string): Promise<BatchSession | undefined>;
  listBatchTasks(sessionId: string): Promise<BatchTask[]>;
  getBatchStatus(sessionId: string): Promise<ProcessingStatus>;
  subscribeToProgress(sessionId: string, callback: (event: any) => void): () => void;

  // Tiles / features
  getProcessedFeatureCount(nodeId: NodeId): Promise<number>;
  getVectorTileInfo(nodeId: NodeId, z: number, x: number, y: number): Promise<TileInfo | undefined>;

  // Status
  getProcessingStatus(nodeId: NodeId): Promise<ProcessingStatus>;
  cleanupProcessingData(nodeId: NodeId): Promise<void>;
}

export type { NodeId } from '../shared/index.js';
