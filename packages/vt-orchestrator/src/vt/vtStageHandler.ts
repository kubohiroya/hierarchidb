import type { VTStageContext } from '~/contexts';
import type { StageHandler, StageHandlerResult, VtTaskInput } from '~/types/types';
import { executeVtTask } from './vtStageTaskProcessor.js';

export const createVtHandler = (context: VTStageContext): StageHandler<VtTaskInput> => {
  return async (task): Promise<StageHandlerResult> => executeVtTask(context, task);
};
