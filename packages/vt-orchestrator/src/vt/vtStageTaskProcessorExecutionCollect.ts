import type { VtTaskInput } from '~/types/types';
import type { VTStageContext } from '~/contexts';
import { getHeapSnapshot } from './vtStageCore.js';
import { collectForVtTask } from './vtStageTaskCollectionFlow.js';
import { logVtCollectDuration, logVtCollectStart } from './vtStageTaskProcessorLogger.js';
import type { TaskContextForVt, VtTaskRunInput } from './vtStageTaskTypes.js';
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
  logVtCollectStart(
    taskContext,
    taskInput.bufferIds.length,
    getHeapSnapshot(),
  );
  const collected = await collectForVtTask(context, {
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
  if (collected) {
    logVtCollectDuration(taskContext, Date.now() - collectStartedAt);
  }
  return collected;
};
