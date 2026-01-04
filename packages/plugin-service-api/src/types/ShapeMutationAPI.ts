import type { NodeId } from '@hierarchidb/common-types';
import type {
  ShapeBatchTaskRecord,
  ShapeExtractedBufferRecord,
  ShapeFeatureMetadataRow,
  ShapeRawBufferRecord,
  ShapeSourceMetadataRow,
} from './shapeBatchTypes.js';
import type { ShapeBatchSessionRecord, ShapeVectorTileRecord } from './shapeDbTypes.js';

export interface ShapeMutationAPI {
  upsertBatchSession(session: ShapeBatchSessionRecord): Promise<void>;
  updateBatchSession(nodeId: NodeId, updates: Partial<ShapeBatchSessionRecord>): Promise<void>;
  deleteBatchSession(nodeId: NodeId): Promise<void>;
  deleteBatchTasks(nodeId: NodeId): Promise<void>;
  deleteVectorTile(tileId: string): Promise<void>;
  deleteVectorTiles(nodeId: NodeId): Promise<void>;
  deleteTileBuffers(nodeId: NodeId): Promise<void>;
  deleteFeatureBuffers(nodeId: NodeId): Promise<void>;
  deleteFeatures(nodeId: NodeId): Promise<void>;
  clearCache(nodeId: NodeId): Promise<number>;
  cleanupProcessingData(nodeId: NodeId): Promise<void>;
  clearShapeArtifacts(nodeId: NodeId): Promise<void>;
  upsertBatchTasks(tasks: ShapeBatchTaskRecord[]): Promise<void>;
  updateBatchTask(taskId: string, updates: Partial<ShapeBatchTaskRecord>): Promise<void>;
  putRawBuffers(buffers: ShapeRawBufferRecord[]): Promise<void>;
  putExtractedBuffers(buffers: ShapeExtractedBufferRecord[]): Promise<void>;
  putSourceMetadata(rows: ShapeSourceMetadataRow[]): Promise<void>;
  deleteSourceMetadataByIds(ids: string[]): Promise<void>;
  deleteSourceMetadataByNode(nodeId: string): Promise<void>;
  putFeatureMetadata(rows: ShapeFeatureMetadataRow[]): Promise<void>;
  deleteFeatureMetadataByNode(nodeId: string): Promise<void>;
  syncVectorTilesFromTilesDb(nodeId: NodeId): Promise<void>;
  storeVectorTile(tile: ShapeVectorTileRecord): Promise<void>;
}
