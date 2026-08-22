import type { VTStageContext } from '~/contextTypes';
import type { StageHandlerResult, VtTaskInput } from '~/types/types';
import { buildAndWriteVtTiles } from './buildAndWriteVtTiles.js';
import type { VtCollectionResult, VtTaskRunInput } from './vtStageTaskTypes.js';

type VtTaskBuildExecutionInput = {
  context: VTStageContext;
  task: {
    taskId: string;
    nodeId: string | number;
  };
  input: VtTaskInput;
  runInput: VtTaskRunInput;
  collection: VtCollectionResult;
};

export const writeVtTaskByRunFlow = async (
  input: VtTaskBuildExecutionInput
): Promise<StageHandlerResult> => {
  const { context, task, input: taskInput, runInput, collection } = input;
  return buildAndWriteVtTiles(context, task, taskInput, runInput, collection);
};
