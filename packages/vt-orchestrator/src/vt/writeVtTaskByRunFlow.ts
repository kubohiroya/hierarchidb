import type { StageHandlerResult, VtTaskInput } from '~/types/types';
import type { VTStageContext } from '~/contextTypes';
import { buildAndWriteVtTiles } from './buildAndWriteVtTiles.js';
import type { VtTaskRunInput } from './vtStageTaskTypes.js';
import type { VtCollectionResult } from './vtStageTaskTypes.js';

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
  input: VtTaskBuildExecutionInput,
): Promise<StageHandlerResult> => {
  const {
    context,
    task,
    input: taskInput,
    runInput,
    collection,
  } = input;
  return buildAndWriteVtTiles(context, task, taskInput, runInput, collection);
};
