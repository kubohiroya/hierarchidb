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
  ShapeExtractedBufferRecord,
  ShapeFeatureMetadataRow,
  ShapeRawBufferRecord,
  ShapeSourceMetadataRow,
  ShapeTileRow,
} from './shapeBatchTypes.js';

export interface ShapeQueryAPI {
  listBatchSessions(nodeId: NodeId): Promise<ShapeBatchSessionSummary[]>;
  getBatchSession(nodeId: NodeId): Promise<ShapeBatchSessionSummary | null>;
  listBatchTasks(nodeId: NodeId): Promise<ShapeBatchTaskSummary[]>;
  listBatchTaskRecords(nodeId: NodeId): Promise<ShapeBatchTaskRecord[]>;
  listBatchTaskRecordsByStage(nodeId: NodeId, stage: ShapeBatchTaskStage): Promise<ShapeBatchTaskRecord[]>;
  getBatchTaskRecord(taskId: string): Promise<ShapeBatchTaskRecord | null>;
  getProcessingStatus(nodeId: NodeId): Promise<ShapeProcessingStatus | null>;
  getProcessedFeatureCount(nodeId: NodeId): Promise<number>;
  getVectorTileInfo(nodeId: NodeId, z: number, x: number, y: number): Promise<ShapeTileInfo | null>;
  getVectorTile(nodeId: NodeId, z: number, x: number, y: number): Promise<Uint8Array | null>;
  listVectorTiles(nodeId: NodeId): Promise<ShapeTileSummaryEntry[]>;
  getVectorTileSummary(nodeId: NodeId): Promise<ShapeTileSummary>;
  listRawBuffers(nodeId: NodeId): Promise<ShapeRawBufferRecord[]>;
  getRawBuffer(bufferId: string): Promise<ShapeRawBufferRecord | null>;
  listExtractedBuffers(nodeId: NodeId, stage?: 'extract1' | 'extract2'): Promise<ShapeExtractedBufferRecord[]>;
  getExtractedBuffer(bufferId: string): Promise<ShapeExtractedBufferRecord | null>;
  listVectorTileRows(nodeId: NodeId): Promise<ShapeTileRow[]>;
  listSourceMetadata(nodeId: NodeId): Promise<ShapeSourceMetadataRow[]>;
  listFeatureMetadata(nodeId: NodeId): Promise<ShapeFeatureMetadataRow[]>;
}
