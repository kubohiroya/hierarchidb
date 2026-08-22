import type { VtTaskQueueDb } from '~/task/taskQueue';
import { updateTask } from '~/task/taskQueue';
import {
  buildProgressPayload,
  calculateProgress,
  shouldReportProgress,
  updateProgressState,
} from './vtStageTaskOutputProgressPolicy.js';
import type { VtTileProgressReporter } from './vtStageTaskOutputTypes.js';

type ProgressMetadata = {
  taskId: string;
  nodeId: string | number;
};

type ProgressTrackerInput = {
  taskQueue: VtTaskQueueDb;
  fixedTaskInfo: ProgressMetadata;
  totalTiles: number;
  parentInputMetadata: Record<string, unknown>;
};

export const createTileProgressReporter = (input: ProgressTrackerInput) => {
  const { taskQueue, fixedTaskInfo, totalTiles, parentInputMetadata } = input;
  let lastReportAt = 0;
  let lastReported = -1;
  let lastMessage: string | null = null;
  const reportTileProgress: VtTileProgressReporter = async (state) => {
    const { processedTiles, generatedTiles, force, message } = state;
    const now = Date.now();
    if (
      !shouldReportProgress({
        force: Boolean(force),
        message,
        lastMessage,
        processedTiles,
        lastReported,
        lastReportAt,
        now,
      })
    ) {
      return;
    }
    ({ lastReportAt, lastReported, lastMessage } = updateProgressState({
      at: now,
      processedTiles,
      message,
    }));

    const payload = buildProgressPayload({
      processedTiles,
      generatedTiles,
      totalTiles,
      parentInputMetadata,
      message,
    });

    try {
      await updateTask(taskQueue, fixedTaskInfo.taskId, {
        ...payload,
        progress: calculateProgress(processedTiles, totalTiles),
      });
    } catch (error) {
      console.warn(
        '[tileEmit] failed to report tile progress',
        JSON.stringify({
          taskId: fixedTaskInfo.taskId,
          nodeId: String(fixedTaskInfo.nodeId),
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  };
  return reportTileProgress;
};
