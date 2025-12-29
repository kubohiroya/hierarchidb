import type { NodeId } from '@hierarchidb/common-types';
import type {
  ShapeBatchSessionSummary,
  ShapeBatchTaskSummary,
  ShapeProcessingStatus,
  ShapeTileInfo,
  ShapeTileSummary,
  ShapeTileSummaryEntry,
} from './shapeTypes.js';

export interface ShapeQueryAPI {
  listBatchSessions(nodeId: NodeId): Promise<ShapeBatchSessionSummary[]>;
  getBatchSession(nodeId: NodeId): Promise<ShapeBatchSessionSummary | null>;
  listBatchTasks(nodeId: NodeId): Promise<ShapeBatchTaskSummary[]>;
  getProcessingStatus(nodeId: NodeId): Promise<ShapeProcessingStatus | null>;
  getProcessedFeatureCount(nodeId: NodeId): Promise<number>;
  getVectorTileInfo(nodeId: NodeId, z: number, x: number, y: number): Promise<ShapeTileInfo | null>;
  getVectorTile(nodeId: NodeId, z: number, x: number, y: number): Promise<Uint8Array | null>;
  listVectorTiles(nodeId: NodeId): Promise<ShapeTileSummaryEntry[]>;
  getVectorTileSummary(nodeId: NodeId): Promise<ShapeTileSummary>;
}
