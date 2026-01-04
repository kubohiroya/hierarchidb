import type { NodeId } from '@hierarchidb/common-types';
import type {
  ShapeBatchTaskRecord,
  ShapeBatchTaskStage,
  ShapeBatchTaskStatus,
  ShapeExtractedBufferRecord,
  ShapeRawBufferRecord,
} from './shapeBatchTypes.js';
import type {
  ShapeEphemeralStage,
  ShapeProcessingCacheEntry,
  ShapeEphemeralSessionRecord,
  ShapeTileIdToBufferRelation,
} from './shapeDbTypes.js';

export interface ShapeEphemeralDBAPI {
  listBatchTasks(nodeId: NodeId): Promise<ShapeBatchTaskRecord[]>;
  listBatchTasksByStatus(nodeId: NodeId, status: ShapeBatchTaskStatus): Promise<ShapeBatchTaskRecord[]>;
  listBatchTasksByType(nodeId: NodeId, taskType: ShapeBatchTaskStage): Promise<ShapeBatchTaskRecord[]>;
  getBatchTask(taskId: string): Promise<ShapeBatchTaskRecord | null>;
  countBatchTasks(nodeId: NodeId): Promise<number>;
  putBatchTasks(tasks: ShapeBatchTaskRecord[]): Promise<void>;
  deleteBatchTasksByNode(nodeId: NodeId): Promise<void>;
  deleteBatchTasksByIds(taskIds: string[]): Promise<void>;
  updateBatchTask(taskId: string, updates: Partial<ShapeBatchTaskRecord>): Promise<void>;

  listRawBuffers(nodeId: NodeId): Promise<ShapeRawBufferRecord[]>;
  getRawBuffer(bufferId: string): Promise<ShapeRawBufferRecord | null>;
  countRawBuffers(nodeId: NodeId): Promise<number>;
  putRawBuffer(buffer: ShapeRawBufferRecord): Promise<void>;
  putRawBuffers(buffers: ShapeRawBufferRecord[]): Promise<void>;

  listExtractedBuffers(nodeId: NodeId, stage?: 'extract1' | 'extract2'): Promise<ShapeExtractedBufferRecord[]>;
  getExtractedBuffer(bufferId: string): Promise<ShapeExtractedBufferRecord | null>;
  countExtractedBuffers(nodeId: NodeId, stage?: 'extract1' | 'extract2'): Promise<number>;
  putExtractedBuffer(buffer: ShapeExtractedBufferRecord): Promise<void>;
  putExtractedBuffers(buffers: ShapeExtractedBufferRecord[]): Promise<void>;

  countVectorTiles(nodeId: NodeId): Promise<number>;

  listTileIdRelations(nodeId: NodeId): Promise<ShapeTileIdToBufferRelation[]>;
  listTileIdRelationsByTileId(nodeId: NodeId, tileId: string): Promise<ShapeTileIdToBufferRelation[]>;
  putTileIdRelations(relations: ShapeTileIdToBufferRelation[]): Promise<void>;
  deleteTileIdRelations(nodeId: NodeId): Promise<void>;

  getSessionRecord(nodeId: NodeId): Promise<ShapeEphemeralSessionRecord | null>;

  deleteFeatureBuffers(nodeId: NodeId): Promise<void>;
  deleteTileBuffers(nodeId: NodeId): Promise<void>;

  countCacheEntries(nodeId: NodeId): Promise<number>;
  putCacheEntries(entries: ShapeProcessingCacheEntry[]): Promise<void>;
  clearCache(nodeId: NodeId): Promise<number>;

  hasStageData(nodeId: NodeId, stage: ShapeEphemeralStage): Promise<boolean>;
  clearStage(nodeId: NodeId, stage: ShapeEphemeralStage): Promise<void>;
  clearNodeData(nodeId: NodeId): Promise<void>;
  clearAll(): Promise<void>;

  clearExpiredCache(): Promise<number>;
  getStatistics(): Promise<{
    rawBuffers: number;
    extractedBuffers: number;
    vectorTiles: number;
    sessions: number;
    cacheEntries: number;
    totalSize: number;
  }>;
}
