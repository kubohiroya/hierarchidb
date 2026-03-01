import type { StageHandlerResult } from '~/types/types';
import { loadTileEmitPbfWithTiming } from './vtStageTaskTilePbfLoader.js';
import { runVtTileOutputFlow } from './vtStageTaskOutput.js';
import { buildTileOutputWriteContext, type VtTaskOutputWriteInput } from './vtStageTaskBuildFlowWriterInput.js';

export const writeVtTaskOutput = async ({
  context,
  task,
  input,
  runInput,
  collection,
  layerResult,
}: VtTaskOutputWriteInput): Promise<StageHandlerResult> => {
  const writeContext = buildTileOutputWriteContext({
    context,
    task,
    input,
    runInput,
    collection,
    layerResult,
  });
  const vtpbf = await loadTileEmitPbfWithTiming({
    taskId: runInput.taskContext.taskId,
    nodeId: runInput.taskContext.nodeId,
  });

  return runVtTileOutputFlow({
    ...writeContext,
    vtpbf,
  });
};
