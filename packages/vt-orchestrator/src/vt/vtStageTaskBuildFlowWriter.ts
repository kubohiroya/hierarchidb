import type { StageHandlerResult } from '~/types/types';
import { loadVtPbfWithTiming } from './vtStageTaskTilePbfLoader.js';
import { writeVtTiles } from './vtStageTaskOutput.js';
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
  const vtpbf = await loadVtPbfWithTiming({
    taskId: runInput.taskContext.taskId,
    nodeId: runInput.taskContext.nodeId,
  });

  return writeVtTiles({
    ...writeContext,
    vtpbf,
  });
};
