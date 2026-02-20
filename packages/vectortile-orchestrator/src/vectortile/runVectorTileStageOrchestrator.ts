import type { RunVectorTileStageOrchestratorParams } from './orchestratorTypes.js';
import type { ProgressInfo } from '~/ports/sharedTypes';

import { defaultStageControls } from '~/common/defaultStageControls';
import { buildVectorTileProgressReporter, resolveRunnableVectorTileTasks } from './resolveRunnableVectorTileTasks.js';
import { runVectorTileAdapter } from './runVectorTileAdapter.js';
import { postprocessVectorTileStage } from './postprocessVectorTileStage.js';

/**
 * Vectortile ステージの共通 orchestrator。
 *
 * - runnableTasks 解決（DB状態の参照）
 * - adapter 実行（並列度・pause/abortの契約）
 * - 進捗合成（baseCompleted/baseFailed を含む）
 * - 後処理（postprocess port）
 */
export async function runVectorTileStageOrchestrator<TTask, TProgress extends ProgressInfo, TInput>(
  params: RunVectorTileStageOrchestratorParams<TTask, TProgress, TInput>,
): Promise<void> {
  const defaults: {
    getSignal: () => AbortSignal;
    waitIfPaused: () => Promise<void>;
    requestPause: (message: string) => void | Promise<void>;
  } = defaultStageControls();

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
    progressFactory,
    postprocess,
    afterRun,
  } = params;

  const normalizedGetSignal = (): AbortSignal => {
    const s = getSignal();
    return s ?? defaults.getSignal();
  };

  // NOTE: registerTasks may include output updates for retry-specific handling.
  await taskRegistry.registerTasks('vectortile', tasks, undefined, inputsByTaskId);

  const { runnableTasks, total, baseCompleted, baseFailed, baseDone } = await resolveRunnableVectorTileTasks({
    nodeId,
    taskRegistry,
    tasks,
  });

  if (runnableTasks.length === 0) {
    const baseProgress: ProgressInfo = {
      total,
      completed: baseCompleted,
      failed: baseFailed,
      skipped: 0,
      percentage: total > 0 ? (baseDone / total) * 100 : 0,
      taskType: 'vectortile',
    };

    // Orchestrator-generated progress events must be converted to TProgress explicitly.
    // (Adapter progress is already TProgress, so this affects only synthesized cases.)
    if (progressCallback) {
      if (typeof progressFactory !== 'function') {
        throw new Error('progressFactory is required when progressCallback is provided (vectortile orchestrator)');
      }
      progressCallback(progressFactory(baseProgress));
    }

    await afterRun({ total, completed: baseCompleted, failed: baseFailed, skipped: 0 });
    return;
  }

  const reportProgress = buildVectorTileProgressReporter<TProgress>({
    total,
    baseCompleted,
    baseFailed,
    progressCallback,
  });

  const r = await runVectorTileAdapter<TTask, TProgress>({
    adapter,
    runnableTasks,
    reportProgress,
    waitIfPaused,
    getSignal: normalizedGetSignal,
    maxConcurrent,
    requestPause,
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
    updateDataSourceMetadataStage: postprocess.updateDataSourceMetadataStage,
    clearFeatureCache: postprocess.clearFeatureCache,
  });
}
