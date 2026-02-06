import type { NodeId } from '@hierarchidb/core-types';
import type {
  ShapeBuildTaskRecord,
  ShapeBuildTaskRecordInput,
  ShapeBuildTaskRecordUpdate,
  ShapeBuildStage,
  ShapeBuildTaskStatus,
  ShapeTransformCache,
  ShapeFetchCache,
} from './shapeBuildTypes.js';
import type {
  ShapeTileIdToBufferRelation,
  //ShapeEphemeralSessionRecord,
} from './shapeDbTypes.js';

export interface EphemeralShapeQueryAPI {
  getBuildTask(taskId: string): Promise<ShapeBuildTaskRecord | null>;
  listBuildTasks(nodeId: NodeId): Promise<ShapeBuildTaskRecord[]>;
  listBuildTasksByStatus(nodeId: NodeId, status: ShapeBuildTaskStatus): Promise<ShapeBuildTaskRecord[]>;
  listBuildTasksByType(nodeId: NodeId, taskType: ShapeBuildStage): Promise<ShapeBuildTaskRecord[]>;
  countBuildTasks(nodeId: NodeId): Promise<number>;

  listFetchCaches(nodeId: NodeId): Promise<ShapeFetchCache[]>;
  getFetchCache(nodeId: NodeId, bufferId: string): Promise<ShapeFetchCache | null>;
  countFetchCaches(nodeId: NodeId): Promise<number>;

  listTransformCaches(nodeId: NodeId): Promise<ShapeTransformCache[]>;
  getTransformCache(bufferId: string): Promise<ShapeTransformCache | null>;
  countTransformCaches(nodeId: NodeId): Promise<number>;

  listTileIdRelations(nodeId: NodeId): Promise<ShapeTileIdToBufferRelation[]>;
  listTileIdRelationsByTileId(nodeId: NodeId, bandIndex: number, tileId: string): Promise<ShapeTileIdToBufferRelation[]>;

  getNumCaches(): Promise<{
    numFetchCaches: number;
    numTransformCaches: number;
    numSessions: number;
    totalSize: number;
  }>;

}
export interface EphemeralShapeMutationAPI {
  putBuildTasks(tasks: ReadonlyArray<ShapeBuildTaskRecordInput>): Promise<void>;
  updateBuildTask(taskId: string, updates: ShapeBuildTaskRecordUpdate): Promise<void>;
  deleteBuildTasksByNode(nodeId: NodeId): Promise<void>;
  deleteBuildTasksByIds(taskIds: string[]): Promise<void>;

  putFetchCache(buffer: ShapeFetchCache): Promise<void>;
  putFetchCaches(buffers: ShapeFetchCache[]): Promise<void>;

  putTransformCache(buffer: ShapeTransformCache): Promise<void>;
  putTransformCaches(buffers: ShapeTransformCache[]): Promise<void>;

  putTileIdRelations(relations: ShapeTileIdToBufferRelation[]): Promise<void>;
  deleteTileIdRelations(nodeId: NodeId): Promise<void>;

  clearAll(): Promise<void>;

}

export interface EphemeralShapeAPI extends EphemeralShapeQueryAPI, EphemeralShapeMutationAPI{

  //getSessionRecord(nodeId: NodeId): Promise<ShapeEphemeralSessionRecord | null>;
  //hasStageData(nodeId: NodeId, stage: ShapeBuildStage): Promise<boolean>;
  //clearStage(nodeId: NodeId, stage: ShapeBuildStage): Promise<void>;
  //clearNodeData(nodeId: NodeId): Promise<void>;

}
