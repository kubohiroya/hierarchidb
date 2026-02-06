import type { NodeId } from '@hierarchidb/core-types';
import type {
  ShapeBuildSessionSummary,
  ShapeBuildTaskSummary,
  ShapeProcessingStatus,
  ShapeTileInfo,
  ShapeTileSummary,
  ShapeTileSummaryEntry,
} from './shapeTypes.js';
import type {
  ShapeBuildTaskRecord,
  ShapeBuildStage,
  ShapeTransformCache,
  ShapeTransformErrorRecord,
  ShapeFeatureMetadata,
  ShapeFetchCache,
  ShapeSourceMetadata,
  ShapeVTMetadata,
} from './shapeBuildTypes.js';
import type { ShapeBuildSessionRecord, ShapeFeatureRecord, ShapeVectorTileRecord } from './shapeDbTypes.js';

export interface ShapeQueryAPI {
  listBuildSessions(nodeId: NodeId): Promise<ShapeBuildSessionSummary[]>;
  getBuildSession(nodeId: NodeId): Promise<ShapeBuildSessionSummary | null>;
  listBuildSessionRecords(nodeId: NodeId): Promise<ShapeBuildSessionRecord[]>;
  getBuildSessionRecord(nodeId: NodeId): Promise<ShapeBuildSessionRecord | null>;
  listBuildSessionRecordsByStatus(
    statuses: Array<'idle' | 'running' | 'paused' | 'completed' | 'failed'>,
  ): Promise<ShapeBuildSessionRecord[]>;
  listBuildTasks(nodeId: NodeId): Promise<ShapeBuildTaskSummary[]>;
  listBuildTaskRecords(nodeId: NodeId): Promise<ShapeBuildTaskRecord[]>;
  listBuildTaskRecordsByStage(nodeId: NodeId, stage: ShapeBuildStage): Promise<ShapeBuildTaskRecord[]>;
  getBuildTaskRecord(taskId: string): Promise<ShapeBuildTaskRecord | null>;
  getProcessingStatus(nodeId: NodeId): Promise<ShapeProcessingStatus | null>;
  getProcessedFeatureCount(nodeId: NodeId): Promise<number>;
  getVectorTileInfo(nodeId: NodeId, z: number, x: number, y: number): Promise<ShapeTileInfo | null>;
  getVectorTileRecord(nodeId: NodeId, z: number, x: number, y: number): Promise<ShapeVectorTileRecord | null>;
  getVectorTile(nodeId: NodeId, z: number, x: number, y: number): Promise<Uint8Array | null>;
  listVectorTiles(nodeId: NodeId): Promise<ShapeTileSummaryEntry[]>;
  getVectorTileSummary(nodeId: NodeId): Promise<ShapeTileSummary>;
  listFeatures(nodeId: NodeId): Promise<ShapeFeatureRecord[]>;
  listFeaturesInBbox(
    nodeId: NodeId,
    bbox: [number, number, number, number],
    adminLevel?: number,
  ): Promise<ShapeFeatureRecord[]>;
  listFetchCaches(nodeId: NodeId): Promise<ShapeFetchCache[]>;
  getFetchCache(nodeId: NodeId, bufferId: string): Promise<ShapeFetchCache | null>;
  listTransformCaches(nodeId: NodeId): Promise<ShapeTransformCache[]>;
  getTransformCache(bufferId: string): Promise<ShapeTransformCache | null>;
  listVTMetadata(nodeId: NodeId): Promise<ShapeVTMetadata[]>;
  listSourceMetadata(nodeId: NodeId): Promise<ShapeSourceMetadata[]>;
  listFeatureMetadata(nodeId: NodeId): Promise<ShapeFeatureMetadata[]>;
  listTransformErrorRecords(nodeId: NodeId): Promise<ShapeTransformErrorRecord[]>;
}
