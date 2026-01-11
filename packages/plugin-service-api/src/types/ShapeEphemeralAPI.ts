import type { NodeId } from '@hierarchidb/common-types';
import type {
  ShapeBuildTaskRecord,
  ShapeBuildStage,
  ShapeBuildTaskStatus,
  ShapeTransformSourceBufferRecord,
  ShapeFetchBufferRecord,
} from './shapeBuildTypes.js';
import type {
  ShapeEphemeralSessionRecord,
  ShapeTileIdToBufferRelation,
  ShapeGeojsonVtIndexRecord,
} from './shapeDbTypes.js';

export interface ShapeEphemeralAPI {

  getBuildTask(taskId: string): Promise<ShapeBuildTaskRecord | null>;
  listBuildTasks(nodeId: NodeId): Promise<ShapeBuildTaskRecord[]>;
  listBuildTasksByStatus(nodeId: NodeId, status: ShapeBuildTaskStatus): Promise<ShapeBuildTaskRecord[]>;
  listBuildTasksByType(nodeId: NodeId, taskType: ShapeBuildStage): Promise<ShapeBuildTaskRecord[]>;
  countBuildTasks(nodeId: NodeId): Promise<number>;
  putBuildTasks(tasks: ShapeBuildTaskRecord[]): Promise<void>;
  deleteBuildTasksByNode(nodeId: NodeId): Promise<void>;
  deleteBuildTasksByIds(taskIds: string[]): Promise<void>;
  updateBuildTask(taskId: string, updates: Partial<ShapeBuildTaskRecord>): Promise<void>;

  listFetchBuffers(nodeId: NodeId): Promise<ShapeFetchBufferRecord[]>;
  getFetchBuffer(nodeId: NodeId, bufferId: string): Promise<ShapeFetchBufferRecord | null>;
  countFetchBuffers(nodeId: NodeId): Promise<number>;
  putFetchBuffer(buffer: ShapeFetchBufferRecord): Promise<void>;
  putFetchBuffers(buffers: ShapeFetchBufferRecord[]): Promise<void>;

  listTransformBuffers(nodeId: NodeId): Promise<ShapeTransformSourceBufferRecord[]>;
  countTransformBuffers(nodeId: NodeId): Promise<number>;
  getTransformBuffer(bufferId: string): Promise<ShapeTransformSourceBufferRecord | null>;
  putTransformBuffer(buffer: ShapeTransformSourceBufferRecord): Promise<void>;
  putTransformBuffers(buffers: ShapeTransformSourceBufferRecord[]): Promise<void>;

  countVectorTiles(nodeId: NodeId): Promise<number>;

  listTileIdRelations(nodeId: NodeId): Promise<ShapeTileIdToBufferRelation[]>;
  listTileIdRelationsByTileId(nodeId: NodeId, tileId: string): Promise<ShapeTileIdToBufferRelation[]>;
  putTileIdRelations(relations: ShapeTileIdToBufferRelation[]): Promise<void>;
  deleteTileIdRelations(nodeId: NodeId): Promise<void>;

  getGeojsonVtIndex(nodeId: NodeId, bufferId: string): Promise<ShapeGeojsonVtIndexRecord | null>;
  putGeojsonVtIndex(record: ShapeGeojsonVtIndexRecord): Promise<void>;

  getSessionRecord(nodeId: NodeId): Promise<ShapeEphemeralSessionRecord | null>;

  deleteFeatureBuffers(nodeId: NodeId): Promise<void>;
  deleteTileBuffers(nodeId: NodeId): Promise<void>;

  hasStageData(nodeId: NodeId, stage: ShapeBuildStage): Promise<boolean>;
  clearStage(nodeId: NodeId, stage: ShapeBuildStage): Promise<void>;
  clearNodeData(nodeId: NodeId): Promise<void>;
  clearAll(): Promise<void>;

  getNumBuffers(): Promise<{
    numFetchBuffers: number;
    numTransformBuffers: number;
    numVTBuffers: number;
    numSessions: number;
    totalSize: number;
  }>;
}
