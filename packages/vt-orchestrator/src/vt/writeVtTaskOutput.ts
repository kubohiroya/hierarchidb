import type { StageHandlerResult } from '~/types/types';
import { loadTileEmitPbfWithTiming } from './loadTileEmitPbfWithTiming.js';
import { runVtTileOutputFlow } from './runVtTileOutputFlow.js';
import { buildTileOutputWriteContext, type VtTaskOutputWriteInput } from './buildTileOutputWriteContext.js';

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
