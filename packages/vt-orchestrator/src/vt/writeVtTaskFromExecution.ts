import type { VTStageContext } from '~/contextTypes';
import type { StageHandlerResult, VtTaskInput } from '~/types/types';
import type { VtCollectionResult, VtTaskRunInput } from './vtStageTaskTypes.js';
import { writeVtTaskByRunFlow } from './writeVtTaskByRunFlow.js';

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

export const writeVtTaskFromExecution = async (
  input: VtTaskBuildExecutionInput
): Promise<StageHandlerResult> => {
  return writeVtTaskByRunFlow(input);
};
