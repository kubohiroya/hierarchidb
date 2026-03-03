import { getHeapSnapshot } from './vtStageCore.js';
import type { TaskContextForVt } from './vtStageTaskTypes.js';

export const logCollectDone = (
  taskContext: TaskContextForVt,
  bufferCount: number,
  durationMs: number,
  collected: boolean,
): void => {
  console.info('[tileEmit] collect done', JSON.stringify({
    ...taskContext,
    bufferCount,
    duration: durationMs,
    collected,
    heap: getHeapSnapshot(),
  }));
};
