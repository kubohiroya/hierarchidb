import { buildVectorTileProgressReporter, resolveRunnableVectorTileTasks } from './resolveRunnableVectorTileTasks.js';
import { runVectorTileAdapter } from './runVectorTileAdapter.js';
import { postprocessVectorTileStage } from './postprocessVectorTileStage.js';
import { defaultStageControls } from '../common/defaultStageControls.js';

import type { RunVectorTileStageOrchestratorParams } from './orchestratorTypes.js';

export async function runVectorTileStageOrchestrator(params: RunVectorTileStageOrchestratorParams): Promise<void> {
  const defaults = defaultStageControls();
  const {
    nodeId,
    metadataEnabled,
    tasks,
    inputsByTaskId,
    taskRegistry,
    adapter,
    maxConcurrent,
    waitIfPaused = defaults.waitIfPaused,
    getSignal = defaults.getSignal,
    requestPause = defaults.requestPause,
    progressCallback,
    postprocess,
    afterRun,
  } = params;

  // NOTE: vectortile は registerTasks 内で regression retry の output 更新など特別扱いがある
  await taskRegistry.registerTasks('vectortile', tasks, undefined, inputsByTaskId);

  const { runnableTasks, total, baseCompleted, baseFailed, baseDone } = await resolveRunnableVectorTileTasks({
    nodeId,
    taskRegistry,
    tasks,
  });

  if (runnableTasks.length === 0) {
    progressCallback?.({
      total,
      completed: baseCompleted,
      failed: baseFailed,
      skipped: 0,
      percentage: total > 0 ? (baseDone / total) * 100 : 0,
      currentStage: 'vectortile',
      currentTask: 'Vector tiles already completed',
    });

    await afterRun({
      total,
      completed: baseCompleted,
      failed: baseFailed,
      skipped: 0,
    });
    return;
  }

  const reportProgress = buildVectorTileProgressReporter({
    total,
    baseCompleted,
    baseFailed,
    progressCallback,
  });

  const r = await runVectorTileAdapter({
    adapter,
    runnableTasks,
    reportProgress,
    waitIfPaused,
    getSignal,
    maxConcurrent,
    requestPause,
    stageForPause: 'vectortile',
  });

  const completed = Math.min(total, baseCompleted + r.processed);
  const failed = Math.min(total - completed, baseFailed + r.failed);
  const skipped = 0;

  // metadataEnabled は postprocess 側で使う。ここでは記録のために read しておく。
  void metadataEnabled;

  await afterRun({ total, completed, failed, skipped });

  await postprocessVectorTileStage({
    persistPlaceholderMetadata: postprocess.persistPlaceholderMetadata,
    syncVectorTilesToShapeStore: postprocess.syncVectorTilesToShapeStore,
    metadataEnabled,
    summarizeVectorTilesByOrigin: postprocess.summarizeVectorTilesByOrigin,
    updateSourceMetadataStage: postprocess.updateSourceMetadataStage,
    clearFeatureCache: postprocess.clearFeatureCache,
  });
}
