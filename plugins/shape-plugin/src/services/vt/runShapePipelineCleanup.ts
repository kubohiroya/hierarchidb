import type { NodeId } from '@hierarchidb/core-types';
import type { EphemeralDB } from '@hierarchidb/gis-sdk';
import type { ShapeRuntimeBuildConfig } from '~/common/types/index';
import { runShapeArtifactCascadeCleanup } from './runShapeArtifactCascadeCleanup.ts';

export type ShapeCleanupStageParams = {
  nodeId: NodeId;
  buildConfig: ShapeRuntimeBuildConfig;
  ephemeralStore: EphemeralDB;
};

export const runShapePipelineCleanup = async (params: ShapeCleanupStageParams): Promise<void> => {
  const cleanupConfig = params.buildConfig.cleanupConfig;
  const stage = cleanupConfig?.deleteSourceFilteredCache
    ? 'source'
    : cleanupConfig?.deleteGeometryCache
      ? 'geometry'
      : cleanupConfig?.deleteTileEmitCache
        ? 'tileEmit'
        : null;
  await runShapeArtifactCascadeCleanup({
    nodeId: params.nodeId,
    target:
      stage === null
        ? { kind: 'invalid-caches', sourceCacheIds: [], geometryCacheIds: [] }
        : { kind: 'stage', stage },
    deleteAllRawSourceBuffers: cleanupConfig?.deleteSourceApiCache === true,
    dependencies: {
      ephemeralStore: params.ephemeralStore,
    },
  });
};
