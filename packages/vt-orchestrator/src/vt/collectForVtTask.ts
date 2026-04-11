import type { VTStageContext } from '~/contextTypes';
import {
  collectTaskFeatures,
} from './collectTaskFeatures.js';
import { logCollectDone } from './logCollectDone.js';
import { buildTaskCollectionMetadata } from './buildTaskCollectionMetadata.js';
import type {
  VtCollectionResult,
  VtTaskCollectInput,
} from './vtStageTaskTypes.js';

export const collectForVtTask = async (
  context: VTStageContext,
  params: VtTaskCollectInput,
): Promise<VtCollectionResult | null> => {
  const {
    taskContext,
    band,
    parent,
    groupByContinent,
  } = params;

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
    Boolean(collected),
  );
  if (!collected) {
    return null;
  }

  const metadata = buildTaskCollectionMetadata(band, parent, collected);
  return {
    ...collected,
    adminFeatureSummary: metadata.adminFeatureSummary,
    tilesByZoom: metadata.tilesByZoom,
    totalTiles: metadata.totalTiles,
    parentInputMetadata: metadata.parentInputMetadata,
    intersectingFeatureCount: metadata.intersectingFeatureCount,
    buildCompletedResult: metadata.buildCompletedResult,
  };
};
