// Public worker API types for @hierarchidb/shape-plugin/worker
// Keep this file type-only and decoupled from internal Dexie types

import type { NodeId } from '@hierarchidb/common-types';
import type { BatchProgressEvent } from '@hierarchidb/common-api';
import type {
  BatchSession,
  BatchTask,
  CountryMetadata,
  DataSourceConfig,
  DataSourceName,
  BatchConfig,
  ProcessingStatus,
  ShapeBatchCommand,
  ShapeBatchCommandPayload,
  ShapeEntity,
  TileInfo,
  DownloadTaskPayload,
  ShapeStepValidationResult,
  SelectedArrayByCountries,
} from '../common/types/index.js';

export interface ShapeBatchAPI {
  // Working copies
  createDraft(nodeId: NodeId): Promise<NodeId>;
  createNewDraftBase(parentId: NodeId): Promise<NodeId>;
  getDraft(draftId: NodeId): Promise<ShapeEntity | undefined>;
  updateDraft(draftId: NodeId, data: Partial<ShapeEntity>): Promise<void>;
  commitDraft(draftId: NodeId): Promise<NodeId>;
  discardDraft(draftId: NodeId): Promise<void>;

  // Data sources
  getDataSourceConfigs(): Promise<DataSourceConfig[]>;
  getCountryMetadata(nodeId: NodeId, dataSource: DataSourceName): Promise<CountryMetadata[]>;
  generateDownloadTaskPayloads(
    nodeId: NodeId,
    dataSource: DataSourceName,
    countries: string[],
    adminLevels: number[],
  ): Promise<DownloadTaskPayload[]>;
  generateDownloadTaskPayloadsFromSelection(
    nodeId: NodeId,
    dataSource: DataSourceName,
    selectedArrayByCountries: SelectedArrayByCountries,
  ): Promise<DownloadTaskPayload[]>;

  // Validation / estimation
  validateSelection(
    countries: string[],
    adminLevels: number[],
    dataSource: DataSourceName,
  ): Promise<ShapeStepValidationResult>;

  // Batch processing (Draft-based)
  startBatchProcess(
    draftId: NodeId,
    config: BatchConfig,
    downloadTaskPayloads: DownloadTaskPayload[],
    progressCallback?: (event: BatchProgressEvent) => void,
  ): Promise<NodeId>;
  pauseBatchProcessing(draftId: NodeId): Promise<void>;
  resumeBatchProcessing(draftId: NodeId): Promise<NodeId>;
  invokeBatchCommand<K extends ShapeBatchCommand>(command: K, payload: ShapeBatchCommandPayload<K>): Promise<void>;
  getBatchSession(nodeId: NodeId): Promise<BatchSession | undefined>;
  listBatchTasks(nodeId: NodeId): Promise<BatchTask[]>;
  getBatchStatus(nodeId: NodeId): Promise<ProcessingStatus>;
  subscribeToProgress(nodeId: NodeId, callback: (event: BatchProgressEvent) => void): () => void;

  // Tiles / features
  getProcessedFeatureCount(nodeId: NodeId): Promise<number>;
  getVectorTileInfo(nodeId: NodeId, z: number, x: number, y: number): Promise<TileInfo | undefined>;

  // Status
  getProcessingStatus(nodeId: NodeId): Promise<ProcessingStatus>;
  cleanupProcessingData(nodeId: NodeId): Promise<void>;
}

export { registerShapeWorkerStores, loadShapeEntitiesDbModule } from './factory/registerShapeWorkerStores.js';
export type { RegisterShapeWorkerStoresOptions } from './factory/registerShapeWorkerStores.js';
