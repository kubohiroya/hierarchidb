import type { NodeId } from '@hierarchidb/common-types';
import type {
  ShapeBuildTaskRecord,
  ShapeTransformSourceBufferRecord,
  ShapeFeatureMetadataRow,
  ShapeFetchBufferRecord,
  ShapeSourceMetadataRow,
} from './shapeBuildTypes.js';
import type { ShapeBatchSessionRecord, ShapeVectorTileRecord } from './shapeDbTypes.js';

export interface ShapeMutationAPI {
  upsertBatchSession(session: ShapeBatchSessionRecord): Promise<void>;
  updateBatchSession(nodeId: NodeId, updates: Partial<ShapeBatchSessionRecord>): Promise<void>;
  deleteBatchSession(nodeId: NodeId): Promise<void>;
  deleteBuildTasks(nodeId: NodeId): Promise<void>;
  deleteVectorTile(tileId: string): Promise<void>;
  deleteVectorTiles(nodeId: NodeId): Promise<void>;
  deleteTileBuffers(nodeId: NodeId): Promise<void>;
  deleteFeatureBuffers(nodeId: NodeId): Promise<void>;
  deleteFeatures(nodeId: NodeId): Promise<void>;
  cleanupProcessingData(nodeId: NodeId): Promise<void>;
  clearShapeArtifacts(nodeId: NodeId): Promise<void>;
  upsertBuildTasks(tasks: ShapeBuildTaskRecord[]): Promise<void>;
  updateBuildTask(taskId: string, updates: Partial<ShapeBuildTaskRecord>): Promise<void>;
  putFetchBuffers(buffers: ShapeFetchBufferRecord[]): Promise<void>;
  putTransformSourceBuffers(buffers: ShapeTransformSourceBufferRecord[]): Promise<void>;
  putSourceMetadata(rows: ShapeSourceMetadataRow[]): Promise<void>;
  deleteSourceMetadataByIds(ids: string[]): Promise<void>;
  deleteSourceMetadataByNode(nodeId: string): Promise<void>;
  putFeatureMetadata(rows: ShapeFeatureMetadataRow[]): Promise<void>;
  deleteFeatureMetadataByNode(nodeId: string): Promise<void>;
  syncVectorTilesFromTilesDb(nodeId: NodeId): Promise<void>;
  storeVectorTile(tile: ShapeVectorTileRecord): Promise<void>;

}
