import { updateTask, VtTaskQueueDb } from '~/task/taskQueue';
import type { TileEmitInvalidGeometryFilterProgress } from './filterInvalidGeometryForTileEmit.js';
import { assertNotAborted } from './vtStageCoreUtils.js';

const CHECK_LABELS: Record<TileEmitInvalidGeometryFilterProgress['check'], string> = {
  area: 'area',
  lineLength: 'line length',
  maxEdgeLength: 'max edge length',
  selfIntersection: 'self intersection',
  triangleRingRatio: 'triangle ring ratio',
};

export const buildInvalidGeometryFilterProgressMessage = (
  progress: TileEmitInvalidGeometryFilterProgress
): string =>
  `Check ${CHECK_LABELS[progress.check]} of polygon ${progress.polygonIndex} of ${progress.polygonTotal}`;

export const createInvalidGeometryFilterProgressReporter = (input: {
  taskId: string;
  nodeId: string;
  abortSignal?: AbortSignal;
}): ((progress: TileEmitInvalidGeometryFilterProgress) => Promise<void>) => {
  const taskQueue = new VtTaskQueueDb();
  let lastUpdatedAt = 0;
  let lastMessage = '';
  return async (progress): Promise<void> => {
    assertNotAborted(input.abortSignal);
    const message = buildInvalidGeometryFilterProgressMessage(progress);
    const now = Date.now();
    const force = progress.polygonIndex === 1 || progress.polygonIndex === progress.polygonTotal;
    if (!force && (message === lastMessage || now - lastUpdatedAt < 120)) return;
    lastUpdatedAt = now;
    lastMessage = message;
    try {
      await updateTask(taskQueue, input.taskId, { message });
    } catch (error) {
      if (input.abortSignal?.aborted) throw error;
      console.warn(
        '[tileEmit] failed to report invalid geometry filter progress',
        JSON.stringify({
          taskId: input.taskId,
          nodeId: input.nodeId,
          message,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  };
};
