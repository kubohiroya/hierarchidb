import type { NodeId } from '@hierarchidb/common-types';
import type {
  ShapeBatchSessionSummary,
  ShapeBuildTaskSummary,
  ShapeProcessingStatus,
  ShapeTileInfo,
  ShapeTileSummary,
  ShapeTileSummaryEntry,
} from './shapeTypes.js';
import type {
  ShapeBuildTaskRecord,
  ShapeBuildStage,
  ShapeTransformSourceBufferRecord,
  ShapeFeatureMetadataRow,
  ShapeFetchBufferRecord,
  ShapeSourceMetadataRow,
  ShapeTileRow,
} from './shapeBuildTypes.js';
import type { ShapeBatchSessionRecord, ShapeFeatureRecord, ShapeVectorTileRecord } from './shapeDbTypes.js';

export interface ShapeQueryAPI {
  listBatchSessions(nodeId: NodeId): Promise<ShapeBatchSessionSummary[]>;
  getBatchSession(nodeId: NodeId): Promise<ShapeBatchSessionSummary | null>;
  listBatchSessionRecords(nodeId: NodeId): Promise<ShapeBatchSessionRecord[]>;
  getBatchSessionRecord(nodeId: NodeId): Promise<ShapeBatchSessionRecord | null>;
  listBatchSessionRecordsByStatus(
    statuses: Array<'idle' | 'running' | 'paused' | 'completed' | 'failed'>,
  ): Promise<ShapeBatchSessionRecord[]>;
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
  listFetchBuffers(nodeId: NodeId): Promise<ShapeFetchBufferRecord[]>;
  getFetchBuffer(nodeId: NodeId, bufferId: string): Promise<ShapeFetchBufferRecord | null>;
  listTransformSourceBuffers(nodeId: NodeId): Promise<ShapeTransformSourceBufferRecord[]>;
  getTransformSourceBuffer(bufferId: string): Promise<ShapeTransformSourceBufferRecord | null>;
  listVectorTileRows(nodeId: NodeId): Promise<ShapeTileRow[]>;
  listSourceMetadata(nodeId: NodeId): Promise<ShapeSourceMetadataRow[]>;
  listFeatureMetadata(nodeId: NodeId): Promise<ShapeFeatureMetadataRow[]>;
}
