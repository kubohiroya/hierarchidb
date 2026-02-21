import { getHeapSnapshot } from './vtStageCore.js';
import { loadVtPbf } from './vtStageFeatureSource.js';

export const loadVtPbfWithTiming = async (taskContext: { taskId: string; nodeId: string }): Promise<typeof import('@maplibre/vt-pbf')> => {
  const startedAt = Date.now();
  const vtpbf = await loadVtPbf();
  console.info('[vt] vtpbf load done', JSON.stringify({
    ...taskContext,
    duration: Date.now() - startedAt,
    heap: getHeapSnapshot(),
  }));
  return vtpbf;
};
