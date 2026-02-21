import type { VTStageContext } from '~/contexts';
import type { StageHandlerResult } from '~/types/types';
import type { TaskContextForVt, VtTaskRunInput } from './vtStageTaskTypes.js';

export type VtTaskProcessorExecutionRunInput = {
  context: VTStageContext;
  taskContext: TaskContextForVt;
  band: VtTaskRunInput['band'];
  parent: VtTaskRunInput['parent'];
  debugCollect: boolean;
  debugFocusConfig: VtTaskRunInput['debugFocusConfig'];
  groupByContinent: boolean;
  useTopojsonTileSimplify: boolean;
  topojsonSimplify: VtTaskRunInput['topojsonSimplify'];
};

export const buildVtTaskRunInput = (
  input: VtTaskProcessorExecutionRunInput,
): VtTaskRunInput => ({
  context: input.context,
  taskContext: input.taskContext,
  band: input.band,
  parent: input.parent,
  debugCollect: input.debugCollect,
  debugFocusConfig: input.debugFocusConfig,
  groupByContinent: input.groupByContinent,
  useTopojsonTileSimplify: input.useTopojsonTileSimplify,
  topojsonSimplify: input.topojsonSimplify,
});

export const buildSkippedVtTaskResult = (message: string): StageHandlerResult => ({
  status: 'completed',
  message,
});

