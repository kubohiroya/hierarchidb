// Public worker API types for @hierarchidb/shape-plugin/worker
// Keep this file type-only and decoupled from internal Dexie types

import type {
  BatchProgressEvent,
  BatchSession,
  BatchTask,
  CountryMetadata,
  DataSourceConfig,
  NodeId,
  ProcessingConfig,
  ProcessingStatus,
  SelectionStats,
  ShapeBatchCommand,
  ShapeBatchCommandPayload,
  ShapeEntity,
  TileInfo,
  UrlMetadata,
  ShapeStepValidationResult,
} from '../common/types/index.js';

export interface ShapeWorkerAPI {
  // Working copies
  createDraft(nodeId: NodeId): Promise<NodeId>;
  createNewDraftBase(parentId: NodeId): Promise<NodeId>;
  getDraft(draftId: NodeId): Promise<ShapeEntity | undefined>;
  updateDraft(draftId: NodeId, data: Partial<ShapeEntity>): Promise<void>;
  commitDraft(draftId: NodeId): Promise<NodeId>;
  discardDraft(draftId: NodeId): Promise<void>;

  // Data sources
  getDataSourceConfigs(): Promise<DataSourceConfig[]>;
  getCountryMetadata(dataSource: string): Promise<CountryMetadata[]>;
  generateUrlMetadata(dataSource: string, countries: string[], adminLevels: number[]): Promise<UrlMetadata[]>;

  // Validation / estimation
  validateSelection(
    countries: string[],
    adminLevels: number[],
    dataSource: string,
  ): Promise<ShapeStepValidationResult>;
  calculateSelectionStats(urlMetadata: UrlMetadata[]): Promise<SelectionStats>;

  // Batch processing (Draft-based)
  startBatchProcessing(
    draftId: NodeId,
    config: ProcessingConfig,
    urlMetadata: UrlMetadata[],
    progressCallback?: (event: BatchProgressEvent) => void,
  ): Promise<string>; // returns sessionId
  pauseBatchProcessing(draftId: NodeId): Promise<void>;
  resumeBatchProcessing(draftId: NodeId): Promise<string>;
  cancelBatchProcessing(draftId: NodeId): Promise<void>;
  invokeBatchCommand<K extends ShapeBatchCommand>(command: K, payload: ShapeBatchCommandPayload<K>): Promise<void>;
  getBatchSession(sessionId: string): Promise<BatchSession | undefined>;
  listBatchTasks(sessionId: string): Promise<BatchTask[]>;
  getBatchStatus(sessionId: string): Promise<ProcessingStatus>;
  subscribeToProgress(sessionId: string, callback: (event: BatchProgressEvent) => void): () => void;

  // Tiles / features
  getProcessedFeatureCount(nodeId: NodeId): Promise<number>;
  getVectorTileInfo(nodeId: NodeId, z: number, x: number, y: number): Promise<TileInfo | undefined>;

  // Status
  getProcessingStatus(nodeId: NodeId): Promise<ProcessingStatus>;
  cleanupProcessingData(nodeId: NodeId): Promise<void>;
}

export { registerShapeWorkerStores, loadShapeEntitiesDbModule } from './factory/registerShapeWorkerStores.js';
export type { RegisterShapeWorkerStoresOptions } from './factory/registerShapeWorkerStores.js';
