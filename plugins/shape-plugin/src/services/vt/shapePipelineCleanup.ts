import type { NodeId } from '@hierarchidb/common-types';
import type { ShapeBuildConfig } from '../../common/types/index.js';
import { shapeMutationAPIImpl } from '../batch/ShapeBuildAPIClient.ts';
import { deleteRawDataDataSourceBuffersForNode } from '../utils/chunkStore.js';
import type { ephemeralShapeDB } from '@hierarchidb/shape-store';

export type ShapeCleanupStageParams = {
  nodeId: NodeId;
  buildConfig: ShapeBuildConfig;
  ephemeralStore: typeof ephemeralShapeDB;
};

export const runShapePipelineCleanup = async (params: ShapeCleanupStageParams): Promise<void> => {
  const cleanupConfig = params.buildConfig.cleanupConfig;
  if (cleanupConfig?.deleteFetchFilteredCache) {
    await params.ephemeralStore.fetchCache
      .where('nodeId')
      .equals(params.nodeId)
      .delete();
  }
  if (cleanupConfig?.deleteFetchApiCache) {
    await deleteRawDataDataSourceBuffersForNode(params.nodeId);
  }
  if (cleanupConfig?.deleteTransformCache) {
    await params.ephemeralStore.transaction('rw', params.ephemeralStore.transformCache, async () => {
      await params.ephemeralStore.transformCache.where('nodeId').equals(params.nodeId).delete();
    });
  }
  if (cleanupConfig?.deleteVTCache) {
    await shapeMutationAPIImpl.deleteVectorTiles(params.nodeId);
  }
};
