import type { VtLayerBuildInput, VtLayerBuildResult } from './vtStageTaskLayerBuilderTypes.js';
import { assertNotAborted } from './vtStageCore.js';
import { executeLayerBuildFlow } from './vtStageTaskLayerBuilderFlow.js';
import { buildLayerBuildExecutionContext } from './vtStageTaskLayerBuilderPrepare.js';

export const buildLayersForVtTask = async (input: VtLayerBuildInput): Promise<VtLayerBuildResult> => {
  const { completedWithParentInputSummary } = input;

  const preparedContext = await buildLayerBuildExecutionContext({
    ...input,
    completedWithParentInputSummary,
  });

  return executeLayerBuildFlow({
    ...input,
    ...preparedContext,
    assertNotAborted,
    debugFocusConfig: input.debugFocusConfig,
  });
};
