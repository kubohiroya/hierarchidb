import type { StageHandlerResult, VtTaskInput } from '~/types/types';
import type { VTStageContext } from '~/contexts';
import { assertNotAborted } from './vtStageCore.js';
import type { TaskContextForVt, VtTaskRunInput, VtTaskRunMetadata } from './vtStageTaskTypes.js';
import {
  logVtTaskFailure,
} from './vtStageTaskProcessorLogger.js';
import { collectVtTaskForExecution } from './vtStageTaskProcessorExecutionCollect.js';
import { writeVtTaskFromExecution } from './vtStageTaskProcessorExecutionBuild.js';

type VtTaskProcessorExecutionInput = {
  context: VTStageContext;
  task: VtTaskRunMetadata;
  input: VtTaskInput;
  taskContext: TaskContextForVt;
  band: VtTaskRunInput['band'];
  parent: VtTaskRunInput['parent'];
  debugCollect: boolean;
  debugFocusConfig: VtTaskRunInput['debugFocusConfig'];
  groupByContinent: boolean;
  useTopojsonTileSimplify: boolean;
  topojsonSimplify: VtTaskRunInput['topojsonSimplify'];
};

export const executeVtTaskProcessing = async (
  input: VtTaskProcessorExecutionInput,
): Promise<StageHandlerResult> => {
  const {
    context,
    task,
    taskContext,
    band,
    parent,
    debugCollect,
    debugFocusConfig,
    groupByContinent,
    useTopojsonTileSimplify,
    topojsonSimplify,
    input: taskInput,
  } = input;
  const { abortSignal } = context;
  const runInput: VtTaskRunInput = {
    context,
    taskContext,
    band,
    parent,
    debugCollect,
    debugFocusConfig,
    groupByContinent,
    useTopojsonTileSimplify,
    topojsonSimplify,
  };

  try {
    assertNotAborted(abortSignal);
    const collected = await collectVtTaskForExecution({
      context,
      taskContext,
      band,
      parent,
      debugCollect,
      debugFocusConfig,
      groupByContinent,
      useTopojsonTileSimplify,
      topojsonSimplify,
      taskInput,
    });
    if (!collected) {
      return { status: 'completed', message: 'skipped: no features' };
    }
    return writeVtTaskFromExecution({
      context,
      task,
      input: taskInput,
      runInput,
      collection: collected,
    });
  } catch (error) {
    logVtTaskFailure(taskContext, error);
    throw error;
  }
};
