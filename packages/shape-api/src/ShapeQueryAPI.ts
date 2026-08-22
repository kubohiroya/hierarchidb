import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeBuildSessionProbeResult } from './ShapeBuildSessionContractError.js';
import type {
  ShapeBuildStage,
  ShapeBuildTaskRecord,
  ShapeDataSourceMetadata,
  ShapeFeatureMetadata,
  ShapeGeometryCache,
  ShapeGeometryErrorRecord,
  ShapeSourceCache,
  ShapeTileEmitMetadata,
} from './shapeBuildTypes.js';
import type { ShapeBuildSessionRecord, ShapeVectorTileRecord } from './shapeDbTypes.js';
import type {
  ShapeBuildSessionSummary,
  ShapeBuildTaskSummary,
  ShapeProcessingStatus,
  ShapeTileInfo,
  ShapeTileSummary,
  ShapeTileSummaryEntry,
} from './shapeTypes.js';

export interface ShapeQueryAPI {
  listBuildSessions(nodeId: NodeId): Promise<ShapeBuildSessionSummary[]>;
  getBuildSession(nodeId: NodeId): Promise<ShapeBuildSessionSummary | null>;
  listBuildSessionRecords(nodeId: NodeId): Promise<ShapeBuildSessionRecord[]>;
  getBuildSessionRecord(nodeId: NodeId): Promise<ShapeBuildSessionRecord | null>;
  probeBuildSession(nodeId: NodeId): Promise<ShapeBuildSessionProbeResult>;
  listBuildSessionRecordsByStatus(
    statuses: Array<'idle' | 'running' | 'paused' | 'completed' | 'failed'>
  ): Promise<ShapeBuildSessionRecord[]>;
  listBuildTasks(nodeId: NodeId): Promise<ShapeBuildTaskSummary[]>;
  listBuildTaskRecords(nodeId: NodeId): Promise<ShapeBuildTaskRecord[]>;
  listBuildTaskRecordsByStage(
    nodeId: NodeId,
    stage: ShapeBuildStage
  ): Promise<ShapeBuildTaskRecord[]>;
  getBuildTaskRecord(taskId: string): Promise<ShapeBuildTaskRecord | null>;
  getProcessingStatus(nodeId: NodeId): Promise<ShapeProcessingStatus | null>;
  getProcessedFeatureCount(nodeId: NodeId): Promise<number>;
  getVectorTileInfo(nodeId: NodeId, z: number, x: number, y: number): Promise<ShapeTileInfo | null>;
  getVectorTileRecord(
    nodeId: NodeId,
    z: number,
    x: number,
    y: number
  ): Promise<ShapeVectorTileRecord | null>;
  getVectorTile(nodeId: NodeId, z: number, x: number, y: number): Promise<Uint8Array | null>;
  listVectorTiles(nodeId: NodeId): Promise<ShapeTileSummaryEntry[]>;
  getVectorTileSummary(nodeId: NodeId): Promise<ShapeTileSummary>;
  /** Lists raw source-download cache entries; metadata chunks are excluded. */
  listSourceCaches(nodeId: NodeId): Promise<ShapeSourceCache[]>;
  /** Reads a raw source-download cache entry; non-raw chunk keys return null. */
  getSourceCache(nodeId: NodeId, bufferId: string): Promise<ShapeSourceCache | null>;
  listGeometryCaches(nodeId: NodeId): Promise<ShapeGeometryCache[]>;
  getGeometryCache(bufferId: string): Promise<ShapeGeometryCache | null>;
  listTileEmitMetadata(nodeId: NodeId): Promise<ShapeTileEmitMetadata[]>;
  listDataSourceMetadata(nodeId: NodeId): Promise<ShapeDataSourceMetadata[]>;
  listFeatureMetadata(nodeId: NodeId): Promise<ShapeFeatureMetadata[]>;
  listGeometryErrorRecords(nodeId: NodeId): Promise<ShapeGeometryErrorRecord[]>;
}
