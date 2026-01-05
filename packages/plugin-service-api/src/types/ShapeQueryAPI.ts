import type { NodeId } from '@hierarchidb/common-types';
import type {
  ShapeBatchSessionSummary,
  ShapeBatchTaskSummary,
  ShapeProcessingStatus,
  ShapeTileInfo,
  ShapeTileSummary,
  ShapeTileSummaryEntry,
} from './shapeTypes.js';
import type {
  ShapeBatchTaskRecord,
  ShapeBatchTaskStage,
  ShapeExtractSourceBufferRecord,
  ShapeFeatureMetadataRow,
  ShapeRawBufferRecord,
  ShapeSourceMetadataRow,
  ShapeTileRow,
} from './shapeBatchTypes.js';
import type { ShapeBatchSessionRecord, ShapeFeatureRecord, ShapeVectorTileRecord } from './shapeDbTypes.js';

export interface ShapeQueryAPI {
  listBatchSessions(nodeId: NodeId): Promise<ShapeBatchSessionSummary[]>;
  getBatchSession(nodeId: NodeId): Promise<ShapeBatchSessionSummary | null>;
  listBatchSessionRecords(nodeId: NodeId): Promise<ShapeBatchSessionRecord[]>;
  getBatchSessionRecord(nodeId: NodeId): Promise<ShapeBatchSessionRecord | null>;
  listBatchSessionRecordsByStatus(
    statuses: Array<'idle' | 'running' | 'paused' | 'completed' | 'failed'>,
  ): Promise<ShapeBatchSessionRecord[]>;
  listBatchTasks(nodeId: NodeId): Promise<ShapeBatchTaskSummary[]>;
  listBatchTaskRecords(nodeId: NodeId): Promise<ShapeBatchTaskRecord[]>;
  listBatchTaskRecordsByStage(nodeId: NodeId, stage: ShapeBatchTaskStage): Promise<ShapeBatchTaskRecord[]>;
  getBatchTaskRecord(taskId: string): Promise<ShapeBatchTaskRecord | null>;
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
  listRawBuffers(nodeId: NodeId): Promise<ShapeRawBufferRecord[]>;
  getRawBuffer(nodeId: NodeId, bufferId: string): Promise<ShapeRawBufferRecord | null>;
  listExtractedBuffers(nodeId: NodeId, stage?: 'extract1' | 'extract2'): Promise<ShapeExtractSourceBufferRecord[]>;
  getExtractedBuffer(bufferId: string): Promise<ShapeExtractSourceBufferRecord | null>;
  listVectorTileRows(nodeId: NodeId): Promise<ShapeTileRow[]>;
  listSourceMetadata(nodeId: NodeId): Promise<ShapeSourceMetadataRow[]>;
  listFeatureMetadata(nodeId: NodeId): Promise<ShapeFeatureMetadataRow[]>;
}
