import type { StageHandlerResult } from '~/types/types';
import type { VTStageContext } from '~/contextTypes';
import { prepareVtTaskExecution } from './prepareVtTaskExecution.js';
import {
  logVtTaskFocusConfig,
  logVtTaskStart,
} from './vtStageTaskProcessorLoggerUtils.js';
import { executeVtTaskProcessing } from './executeVtTaskProcessing.js';
import type { VtTaskExecutionInput } from './vtStageTaskTypes.js';

type VtTaskProcessorFlowInput = {
  context: VTStageContext;
  task: VtTaskExecutionInput;
};

export const runVtTaskProcessorFlow = async (
  input: VtTaskProcessorFlowInput,
): Promise<StageHandlerResult> => {
  const preparation = prepareVtTaskExecution(input);

  if (preparation.kind === 'skipped') {
    return preparation.result;
  }

  const {
    input: taskInput,
    taskContext,
    band,
    parent,
    debugCollect,
    debugFocusConfig,
    groupByContinent,
    useTopojsonTileSimplify,
    topojsonSimplify,
    bufferIdSample,
    layerSetName,
  } = preparation;

  logVtTaskStart({
    taskContext,
    band,
    layerSetName,
    bufferIdSample,
    groupByContinent,
  });
  logVtTaskFocusConfig(taskContext, debugFocusConfig);

  return executeVtTaskProcessing({
    context: input.context,
    task: {
      taskId: input.task.taskId,
      nodeId: input.task.nodeId,
    },
    input: taskInput,
    taskContext,
    band,
    parent,
    debugCollect,
    debugFocusConfig,
    groupByContinent,
    useTopojsonTileSimplify,
    topojsonSimplify,
  });
};
