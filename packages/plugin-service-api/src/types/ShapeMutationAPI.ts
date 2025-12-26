import type { NodeId } from '@hierarchidb/common-types';

export interface ShapeMutationAPI {
  deleteBatchSession(sessionId: string): Promise<void>;
  deleteBatchTasks(sessionId: string): Promise<void>;
  deleteVectorTiles(nodeId: NodeId): Promise<void>;
  deleteTileBuffers(nodeId: NodeId): Promise<void>;
  deleteFeatureBuffers(nodeId: NodeId): Promise<void>;
  deleteFeatures(nodeId: NodeId): Promise<void>;
  clearCache(nodeId: NodeId): Promise<number>;
  cleanupProcessingData(nodeId: NodeId): Promise<void>;
}
