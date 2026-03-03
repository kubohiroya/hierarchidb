import type { VTStageContext } from '~/contexts';
import { getCollectDebugSettings } from './vtStageFeatureCollectorDebugSettings.js';
import { runFeatureCollectionCoordinator } from './runFeatureCollectionCoordinator.js';
import { getCollectTimeoutMs, withCollectTimeout } from './vtStageTaskCollectorTimeout.js';
import type { CollectedVtFeatures } from './vtStageTaskTypes.js';

export const collectTaskFeatures = async (
  context: VTStageContext,
  input: {
    nodeId: string;
    bufferIds: string[];
    groupByContinent: boolean;
    taskId: string;
  },
): Promise<CollectedVtFeatures | null> => {
  const { testTimeoutMs } = getCollectDebugSettings();
  const collectPromise = runFeatureCollectionCoordinator({
    context,
    bufferIds: input.bufferIds,
    nodeId: input.nodeId,
    options: {
      groupByContinent: input.groupByContinent,
      continentByCountry: context.continentByCountry,
    },
  });
  return withCollectTimeout<CollectedVtFeatures | null>({
    nodeId: input.nodeId,
    taskId: input.taskId,
    promise: collectPromise,
    timeoutMs: getCollectTimeoutMs({ testTimeoutMs }),
  });
};
