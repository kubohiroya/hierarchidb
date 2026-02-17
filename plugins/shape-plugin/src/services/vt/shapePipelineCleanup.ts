import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeRuntimeBuildConfig } from '../../common/types/index.js';
import { shapeMutationAPIImpl } from '../batch/ShapeBuildAPIClient.ts';
import { deleteRawDataDataSourceBuffersForNode } from '../utils/chunkStore.js';
import type { EphemeralDB } from '@hierarchidb/gis-sdk';

export type ShapeCleanupStageParams = {
  nodeId: NodeId;
  buildConfig: ShapeRuntimeBuildConfig;
  ephemeralStore: EphemeralDB;
};

export const runShapePipelineCleanup = async (params: ShapeCleanupStageParams): Promise<void> => {
  const cleanupConfig = params.buildConfig.cleanupConfig;
  if (cleanupConfig?.deleteFetchFilteredCache) {
    await params.ephemeralStore.fetchCache
      .where('nodeId')
      .equals(params.nodeId)
      .delete();
    await params.ephemeralStore.fetchCacheMeta
      .where('nodeId')
      .equals(params.nodeId)
      .delete();
  }
  if (cleanupConfig?.deleteFetchApiCache) {
    await deleteRawDataDataSourceBuffersForNode(params.nodeId);
  }
  if (cleanupConfig?.deleteTransformCache) {
    await params.ephemeralStore.transformCache.where('nodeId').equals(params.nodeId).delete();
    await params.ephemeralStore.transformCacheMeta.where('nodeId').equals(params.nodeId).delete();
  }
  if (cleanupConfig?.deleteVTCache) {
    await shapeMutationAPIImpl.deleteVectorTiles(params.nodeId);
  }
};
