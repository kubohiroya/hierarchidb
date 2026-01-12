import type { NodeId } from '@hierarchidb/common-types';
import type {
  ShapeBuildTaskRecord,
  ShapeBuildStage,
  ShapeBuildTaskStatus,
  ShapeTransformByBandCache,
  ShapeFetchCache,
} from './shapeBuildTypes.js';
import type {
  ShapeTileIdToBufferRelation,
  ShapeGeojsonVtIndexRecord,
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

  listTransformByBandCaches(nodeId: NodeId): Promise<ShapeTransformByBandCache[]>;
  getTransformByBandCache(bufferId: string): Promise<ShapeTransformByBandCache | null>;
  countTransformByBandCaches(nodeId: NodeId): Promise<number>;

  listTileIdRelations(nodeId: NodeId): Promise<ShapeTileIdToBufferRelation[]>;
  listTileIdRelationsByTileId(nodeId: NodeId, tileId: string): Promise<ShapeTileIdToBufferRelation[]>;

  getGeojsonVtIndex(nodeId: NodeId, bufferId: string): Promise<ShapeGeojsonVtIndexRecord | null>;
  countVectorTiles(nodeId: NodeId): Promise<number>;

  getNumCaches(): Promise<{
    numFetchCaches: number;
    numTransformCaches: number;
    numVtCaches: number;
    numSessions: number;
    totalSize: number;
  }>;

}
export interface EphemeralShapeMutationAPI {
  putBuildTasks(tasks: ShapeBuildTaskRecord[]): Promise<void>;
  updateBuildTask(taskId: string, updates: Partial<ShapeBuildTaskRecord>): Promise<void>;
  deleteBuildTasksByNode(nodeId: NodeId): Promise<void>;
  deleteBuildTasksByIds(taskIds: string[]): Promise<void>;

  putFetchCache(buffer: ShapeFetchCache): Promise<void>;
  putFetchCaches(buffers: ShapeFetchCache[]): Promise<void>;

  putTransformByBandCache(buffer: ShapeTransformByBandCache): Promise<void>;
  putTransformByBandCaches(buffers: ShapeTransformByBandCache[]): Promise<void>;

  putTileIdRelations(relations: ShapeTileIdToBufferRelation[]): Promise<void>;
  deleteTileIdRelations(nodeId: NodeId): Promise<void>;

  putGeojsonVtIndex(record: ShapeGeojsonVtIndexRecord): Promise<void>;

  deleteFeatureBuffers(nodeId: NodeId): Promise<void>;
  deleteTileBuffers(nodeId: NodeId): Promise<void>;

  clearAll(): Promise<void>;

}

export interface EphemeralShapeAPI extends EphemeralShapeQueryAPI, EphemeralShapeMutationAPI{

  //getSessionRecord(nodeId: NodeId): Promise<ShapeEphemeralSessionRecord | null>;
  //hasStageData(nodeId: NodeId, stage: ShapeBuildStage): Promise<boolean>;
  //clearStage(nodeId: NodeId, stage: ShapeBuildStage): Promise<void>;
  //clearNodeData(nodeId: NodeId): Promise<void>;

}
