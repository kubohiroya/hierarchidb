import type { VTStageContext } from '~/contextTypes';
import type { StageHandler, StageHandlerResult, VtTaskInput } from '~/types/types';
import { runVtTaskProcessorFlow } from './runVtTaskProcessorFlow.js';

export const createVtHandler = (context: VTStageContext): StageHandler<VtTaskInput> => {
  return async (task): Promise<StageHandlerResult> =>
    runVtTaskProcessorFlow({
      context,
      task,
    });
};
