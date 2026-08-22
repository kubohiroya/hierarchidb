import type { NodeId } from '@hierarchidb/core-types';
import type {
  ShapeBuildSessionRecoveryRequest,
  ShapeBuildSessionRecoveryResult,
} from './ShapeBuildSessionContractError.js';
import type {
  ShapeBuildTaskRecordInput,
  ShapeBuildTaskRecordUpdate,
  ShapeDataSourceMetadata,
  ShapeFeatureMetadata,
  ShapeGeometryCache,
  ShapeSourceCache,
} from './shapeBuildTypes.js';
import type { ShapeBuildSessionRecord, ShapeVectorTileRecord } from './shapeDbTypes.js';

export interface ShapeMutationAPI {
  upsertBuildSession(session: ShapeBuildSessionRecord): Promise<void>;
  updateBuildSession(nodeId: NodeId, updates: Partial<ShapeBuildSessionRecord>): Promise<void>;
  deleteBuildSession(nodeId: NodeId): Promise<void>;
  recoverLegacyBuildSession(
    request: ShapeBuildSessionRecoveryRequest
  ): Promise<ShapeBuildSessionRecoveryResult>;
  deleteBuildTasks(nodeId: NodeId): Promise<void>;
  deleteVectorTile(tileId: string): Promise<void>;
  deleteVectorTiles(nodeId: NodeId): Promise<void>;
  cleanupProcessingData(nodeId: NodeId): Promise<void>;
  clearShapeArtifacts(nodeId: NodeId): Promise<void>;
  upsertBuildTasks(tasks: ReadonlyArray<ShapeBuildTaskRecordInput>): Promise<void>;
  updateBuildTask(taskId: string, updates: ShapeBuildTaskRecordUpdate): Promise<void>;
  putSourceCaches(buffers: ShapeSourceCache[]): Promise<void>;
  putGeometryCaches(buffers: ShapeGeometryCache[], taskId?: string, taskQueue?: any): Promise<void>;
  putDataSourceMetadata(rows: ShapeDataSourceMetadata[]): Promise<void>;
  deleteDataSourceMetadataByIds(ids: string[]): Promise<void>;
  deleteDataSourceMetadataByNode(nodeId: string): Promise<void>;
  putFeatureMetadata(rows: ShapeFeatureMetadata[]): Promise<void>;
  deleteFeatureMetadataByNode(nodeId: string): Promise<void>;
  syncVectorTilesFromTilesDb(nodeId: NodeId): Promise<void>;
  storeVectorTile(tile: ShapeVectorTileRecord): Promise<void>;
}
