import type { VTStageContext } from '~/contextTypes';
import {
  applyTileEmitInvalidGeometryFilter,
  buildTileEmitInvalidGeometryFilterTaskMetadata,
} from './applyTileEmitInvalidGeometryFilter.js';
import { buildTaskCollectionMetadata } from './buildTaskCollectionMetadata.js';
import { collectTaskFeatures } from './collectTaskFeatures.js';
import { createInvalidGeometryFilterProgressReporter } from './createInvalidGeometryFilterProgressReporter.js';
import { logCollectDone } from './logCollectDone.js';
import type { VtCollectionResult, VtTaskCollectInput } from './vtStageTaskTypes.js';

export const collectForVtTask = async (
  context: VTStageContext,
  params: VtTaskCollectInput
): Promise<VtCollectionResult | null> => {
  const { taskContext, band, parent, groupByContinent } = params;

  const collectStartedAt = Date.now();
  const collected = await collectTaskFeatures(context, {
    nodeId: taskContext.nodeId,
    bufferIds: params.input.bufferIds,
    groupByContinent,
    taskId: taskContext.taskId,
  });

  logCollectDone(
    taskContext,
    params.input.bufferIds.length,
    Date.now() - collectStartedAt,
    Boolean(collected)
  );
  if (!collected) {
    return null;
  }

  const filtered = await applyTileEmitInvalidGeometryFilter(
    collected,
    context,
    createInvalidGeometryFilterProgressReporter({
      taskId: taskContext.taskId,
      nodeId: taskContext.nodeId,
      abortSignal: context.abortSignal,
    })
  );
  const metadata = buildTaskCollectionMetadata(band, parent, filtered.collected);
  const parentInputMetadata = buildTileEmitInvalidGeometryFilterTaskMetadata(
    metadata.parentInputMetadata,
    filtered.metrics
  );
  return {
    ...filtered.collected,
    adminFeatureSummary: metadata.adminFeatureSummary,
    tilesByZoom: metadata.tilesByZoom,
    totalTiles: metadata.totalTiles,
    parentInputMetadata,
    intersectingFeatureCount: metadata.intersectingFeatureCount,
    buildCompletedResult: (message) => ({
      ...metadata.buildCompletedResult(message),
      metadata: parentInputMetadata,
    }),
  };
};
