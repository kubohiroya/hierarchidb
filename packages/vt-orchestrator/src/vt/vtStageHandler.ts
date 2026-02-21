import type { VTStageContext } from '~/contexts';
import type { StageHandler, StageHandlerResult, VtTaskInput } from '~/types/types';
import { runVtTaskProcessorFlow } from './vtStageTaskProcessor.js';

export const createVtHandler = (context: VTStageContext): StageHandler<VtTaskInput> => {
  return async (task): Promise<StageHandlerResult> => runVtTaskProcessorFlow({
    context,
    task,
  });
};
