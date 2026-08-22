import type { VTStageContext } from '~/contextTypes';
import type { VtTaskInput } from '~/types/types';
import { collectForVtTask } from './collectForVtTask.js';
import { getHeapSnapshot } from './vtStageCoreUtils.js';
import { logVtCollectDuration, logVtCollectStart } from './vtStageTaskProcessorLoggerUtils.js';
import type { TaskContextForVt, VtCollectionResult, VtTaskRunInput } from './vtStageTaskTypes.js';

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

export const logCollectStartWithHeap = (
  taskContext: TaskContextForVt,
  taskInput: VtTaskInput
): void => {
  logVtCollectStart(taskContext, taskInput.bufferIds.length, getHeapSnapshot());
};

export const collectForVtTaskWithInput = async (
  input: VtTaskCollectionExecutionInput
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

  return collectForVtTask(context, {
    context,
    taskContext,
    band,
    parent,
    debugCollect,
    debugFocusConfig,
    groupByContinent,
    useTopojsonTileSimplify,
    topojsonSimplify,
    input: {
      bufferIds: taskInput.bufferIds,
    },
  });
};

export const logCollectDurationIfNeeded = (
  taskContext: TaskContextForVt,
  collectStartedAt: number,
  collected: VtCollectionResult | null
): void => {
  if (collected) {
    logVtCollectDuration(taskContext, Date.now() - collectStartedAt);
  }
};
