import type { NodeId } from '@hierarchidb/common-types';
import type {
  ShapeBuildTaskRecord,
  ShapeTransformByBandCache,
  ShapeFeatureMetadata,
  ShapeFetchCache,
  ShapeSourceMetadata,
} from './shapeBuildTypes.js';
import type { ShapeBuildSessionRecord, ShapeVectorTileRecord } from './shapeDbTypes.js';

export interface ShapeMutationAPI {
  upsertBuildSession(session: ShapeBuildSessionRecord): Promise<void>;
  updateBuildSession(nodeId: NodeId, updates: Partial<ShapeBuildSessionRecord>): Promise<void>;
  deleteBuildSession(nodeId: NodeId): Promise<void>;
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
  putFetchCaches(buffers: ShapeFetchCache[]): Promise<void>;
  putTransformByBandCaches(buffers: ShapeTransformByBandCache[]): Promise<void>;
  putSourceMetadata(rows: ShapeSourceMetadata[]): Promise<void>;
  deleteSourceMetadataByIds(ids: string[]): Promise<void>;
  deleteSourceMetadataByNode(nodeId: string): Promise<void>;
  putFeatureMetadata(rows: ShapeFeatureMetadata[]): Promise<void>;
  deleteFeatureMetadataByNode(nodeId: string): Promise<void>;
  syncVectorTilesFromTilesDb(nodeId: NodeId): Promise<void>;
  storeVectorTile(tile: ShapeVectorTileRecord): Promise<void>;

}
