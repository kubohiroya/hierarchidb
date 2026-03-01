import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeRuntimeBuildConfig } from '~/common/types/index';
import { shapeMutationAPIImpl } from '~/services/build/ShapeBuildAPIClient';
import { deleteRawDataDataSourceBuffersForNode } from '~/services/utils/chunkStore';
import type { EphemeralDB } from '@hierarchidb/gis-sdk';

export type ShapeCleanupStageParams = {
  nodeId: NodeId;
  buildConfig: ShapeRuntimeBuildConfig;
  ephemeralStore: EphemeralDB;
};

export const runShapePipelineCleanup = async (params: ShapeCleanupStageParams): Promise<void> => {
  const cleanupConfig = params.buildConfig.cleanupConfig;
  if (cleanupConfig?.deleteSourceFilteredCache) {
    await params.ephemeralStore.sourceCache
      .where('nodeId')
      .equals(params.nodeId)
      .delete();
    await params.ephemeralStore.sourceCacheMeta
      .where('nodeId')
      .equals(params.nodeId)
      .delete();
  }
  if (cleanupConfig?.deleteSourceApiCache) {
    await deleteRawDataDataSourceBuffersForNode(params.nodeId);
  }
  if (cleanupConfig?.deleteGeometryCache) {
    await params.ephemeralStore.geometryCache.where('nodeId').equals(params.nodeId).delete();
    await params.ephemeralStore.geometryCacheMeta.where('nodeId').equals(params.nodeId).delete();
  }
  if (cleanupConfig?.deleteTileEmitCache) {
    await shapeMutationAPIImpl.deleteVectorTiles(params.nodeId);
  }
};
