import type { NodeId } from '@hierarchidb/common-types';
import type { ProgressInfo, VectorTileTask } from '../../../../../common/types/index.js';
import type { ShapeVectorTileTaskInputData } from '@hierarchidb/plugin-service-api';

import type { VectorTileStageAdapter } from '../../../adapters/VectorTileStageAdapter.js';
import { buildVectorTileProgressReporter, resolveRunnableVectorTileTasks } from './resolveRunnableVectorTileTasks.js';
import { runVectorTileAdapter } from './runVectorTileAdapter.js';

export async function runVectorTileStageOrchestrator(params: {
  nodeId: NodeId;
  metadataEnabled: boolean;

  tasks: VectorTileTask[];
  inputsByTaskId: Map<string, ShapeVectorTileTaskInputData>;

  taskRegistry: {
    registerTasks: (
      stage: 'vectortile',
      tasks: VectorTileTask[],
      existingTaskIds: Set<string> | undefined,
      inputsByTaskId: Map<string, ShapeVectorTileTaskInputData>,
    ) => Promise<void>;
    resolveStageTasks: (
      stage: 'vectortile',
      tasks: VectorTileTask[],
    ) => Promise<{ runnableTasks: VectorTileTask[]; completedCount: number; failedCount: number; total: number }>;
  };

  adapter: VectorTileStageAdapter;
  maxConcurrent?: number;

  waitIfPaused: () => Promise<void>;
  getSignal: () => AbortSignal;
  requestPause?: (message: string) => void | Promise<void>;

  progressCallback?: (progress: ProgressInfo) => void;

  afterRun: (summary: { total: number; completed: number; failed: number; skipped: number }) => Promise<void>;
}): Promise<void> {
  const {
    nodeId,
    metadataEnabled,
    tasks,
    inputsByTaskId,
    taskRegistry,
    adapter,
    maxConcurrent,
    waitIfPaused,
    getSignal,
    requestPause,
    progressCallback,
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
}

