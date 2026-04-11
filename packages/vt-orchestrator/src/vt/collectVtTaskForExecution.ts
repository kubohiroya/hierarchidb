import type { VtTaskInput } from '~/types/types';
import type { VTStageContext } from '~/contextTypes';
import type { TaskContextForVt, VtTaskRunInput } from './vtStageTaskTypes.js';
import type { VtCollectionResult } from './vtStageTaskTypes.js';
import {
  collectForVtTaskWithInput,
  logCollectDurationIfNeeded,
  logCollectStartWithHeap,
} from './vtStageTaskProcessorExecutionCollectUtils.js';

type VtTaskCollectionExecutionInput = {
  context: VTStageContext;
  taskContext: TaskContextForVt;
  band: VtTaskRunInput['band'];
  parent: VtTaskRunInput['parent'];
  debugCollect: boolean;
  debugFocusConfig: VtTaskRunInput['debugFocusConfig'];
  groupByContinent: boolean;
  useTopojsonTileSimplify: boolean;
  topojsonSimplify: VtTaskRunInput['topojsonSimplify'];
  taskInput: VtTaskInput;
};

export const collectVtTaskForExecution = async (
  input: VtTaskCollectionExecutionInput,
): Promise<VtCollectionResult | null> => {
  const {
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
  } = input;

  const collectStartedAt = Date.now();
  logCollectStartWithHeap(taskContext, taskInput);
  const collected = await collectForVtTaskWithInput({
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
  logCollectDurationIfNeeded(taskContext, collectStartedAt, collected);
  return collected;
};
