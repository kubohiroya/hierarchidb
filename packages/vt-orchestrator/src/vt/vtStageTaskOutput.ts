import type { VtTileOutputContext } from './vtStageTaskOutputTypes.js';
import type { StageHandlerResult } from '~/types/types';
import { runVtTileOutputFlow } from './vtStageTaskOutputFlow.js';

export const writeVtTiles = async (outputContext: VtTileOutputContext): Promise<StageHandlerResult> => {
  return runVtTileOutputFlow(outputContext);
};
