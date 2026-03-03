import type { VtLayerBuildInput, VtLayerBuildResult } from './vtStageTaskLayerBuilderTypes.js';
import { assertNotAborted } from './vtStageCore.js';
import { executeLayerBuildFlow } from './executeLayerBuildFlow.js';
import { buildLayerBuildExecutionContext } from './buildLayerBuildExecutionContext.js';

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
