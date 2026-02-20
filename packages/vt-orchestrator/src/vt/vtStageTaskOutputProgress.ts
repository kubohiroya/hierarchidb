import { updateTask } from '~/task/taskQueue';
import type { VtTaskQueueDb } from '~/task/taskQueue';

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

type ProgressReportState = {
  processedTiles: number;
  generatedTiles: number;
  force?: boolean;
  message?: string;
};

export const createTileProgressReporter = (input: ProgressTrackerInput) => {
  const {
    taskQueue,
    fixedTaskInfo,
    totalTiles,
    parentInputMetadata,
  } = input;
  let lastReportAt = 0;
  let lastReported = -1;
  let lastMessage: string | null = null;
  const reportTileProgress = async (state: ProgressReportState): Promise<void> => {
    const { processedTiles, generatedTiles, force, message } = state;
    const shouldReportMessage = Boolean(message && message !== lastMessage);
    if (!force && !shouldReportMessage && processedTiles === lastReported) return;
    const now = Date.now();
    if (!force && !shouldReportMessage && (now - lastReportAt < 500) && (processedTiles - lastReported < 25)) {
      return;
    }
    lastReportAt = now;
    lastReported = processedTiles;
    if (shouldReportMessage && message) {
      lastMessage = message;
    }
    const progress = totalTiles > 0
      ? Math.min(100, Math.max(0, Math.round((processedTiles / totalTiles) * 100)))
      : 0;
    try {
      await updateTask(taskQueue, fixedTaskInfo.taskId, {
        progress,
        ...(shouldReportMessage && message ? { message } : {}),
        metadata: parentInputMetadata,
        outputData: {
          tilesGenerated: generatedTiles,
          totalTiles,
        },
      });
    } catch (error) {
      console.warn('[vt] failed to report tile progress', JSON.stringify({
        taskId: fixedTaskInfo.taskId,
        nodeId: String(fixedTaskInfo.nodeId),
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  };
  return reportTileProgress;
};
