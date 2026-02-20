import type { TransformByBandStageContext } from '~/contexts';
import type { StageHandler, TransformByBandTaskInput } from '~/types/types';
import { createTransformByBandHandler as createTransformByBandHandlerImpl } from './execute.js';

export const createTransformByBandHandler = (
  context: TransformByBandStageContext
): StageHandler<TransformByBandTaskInput> => createTransformByBandHandlerImpl(context);
