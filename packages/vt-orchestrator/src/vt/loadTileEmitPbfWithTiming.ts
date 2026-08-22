import { getHeapSnapshot } from './vtStageCoreUtils.js';
import { loadVtPbf } from './vtStageFeatureSourceUtils.js';

export const loadTileEmitPbfWithTiming = async (taskContext: {
  taskId: string;
  nodeId: string;
}): Promise<typeof import('@maplibre/vt-pbf')> => {
  const startedAt = Date.now();
  const vtpbf = await loadVtPbf();
  console.info(
    '[tileEmit] vtpbf load done',
    JSON.stringify({
      ...taskContext,
      duration: Date.now() - startedAt,
      heap: getHeapSnapshot(),
    })
  );
  return vtpbf;
};
