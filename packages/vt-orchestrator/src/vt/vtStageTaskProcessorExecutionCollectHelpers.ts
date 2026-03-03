import { getHeapSnapshot } from './vtStageCore.js';
import { collectForVtTask } from './collectForVtTask.js';
import { logVtCollectDuration, logVtCollectStart } from './vtStageTaskProcessorLogger.js';
import type { TaskContextForVt, VtTaskRunInput } from './vtStageTaskTypes.js';
import type { VtTaskInput } from '~/types/types';
import type { VTStageContext } from '~/contexts';
import type { VtCollectionResult } from './vtStageTaskTypes.js';

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
  taskInput: VtTaskInput,
): void => {
  logVtCollectStart(
    taskContext,
    taskInput.bufferIds.length,
    getHeapSnapshot(),
  );
};

export const collectForVtTaskWithInput = async (
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
  collected: VtCollectionResult | null,
): void => {
  if (collected) {
    logVtCollectDuration(taskContext, Date.now() - collectStartedAt);
  }
};
