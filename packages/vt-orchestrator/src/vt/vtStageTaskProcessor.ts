import type { StageHandlerResult } from '~/types/types';
import type { VTStageContext } from '~/contexts';
import type { VtTaskExecutionInput } from './vtStageTaskTypes.js';
import { runVtTaskProcessorFlow } from './vtStageTaskProcessorFlow.js';

export const executeVtTask = async (
  context: VTStageContext,
  task: VtTaskExecutionInput,
): Promise<StageHandlerResult> => {
  return runVtTaskProcessorFlow({ context, task });
};
