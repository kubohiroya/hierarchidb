import { VtTaskQueueDb } from '~/task/taskQueue';
import { buildBufferSetHash } from './buildBufferSetHash.js';
import { createTileProgressReporter } from './createTileProgressReporter.js';
import { buildInitialTileProgressMessage } from './vtStageTaskOutputLogging.js';
import { createVtOutputTotals } from './vtStageTaskOutputStats.js';
import type { VtTileProgressReporter } from './vtStageTaskOutputTypes.js';

export type VtTileOutputSession = {
  bufferSetHash: string;
  reportTileProgress: VtTileProgressReporter;
  totals: ReturnType<typeof createVtOutputTotals>;
  startedAt: number;
};

type VtTileOutputSessionInput = {
  taskId: string;
  nodeId: string | number;
  totalTiles: number;
  parentInputMetadata: Record<string, unknown>;
  bufferIds: string[];
};

export const createVtTileOutputSession = async ({
  taskId,
  nodeId,
  totalTiles,
  parentInputMetadata,
  bufferIds,
}: VtTileOutputSessionInput): Promise<VtTileOutputSession> => {
  const taskQueue = new VtTaskQueueDb();
  const bufferSetHash = buildBufferSetHash(bufferIds);
  const progressMetadata = { ...parentInputMetadata };
  delete progressMetadata.resultSeverity;
  const reportTileProgress = createTileProgressReporter({
    taskQueue,
    fixedTaskInfo: {
      taskId,
      nodeId,
    },
    totalTiles,
    parentInputMetadata: progressMetadata,
  });

  await reportTileProgress({
    processedTiles: 0,
    generatedTiles: 0,
    force: true,
    message: buildInitialTileProgressMessage(totalTiles),
  });

  return {
    bufferSetHash,
    reportTileProgress,
    totals: createVtOutputTotals(),
    startedAt: Date.now(),
  };
};
