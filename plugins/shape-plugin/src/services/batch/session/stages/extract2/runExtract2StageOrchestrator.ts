import type { NodeId } from '@hierarchidb/common-types';
import type { Extract2Task, ProgressInfo } from '../../../../../common/types/index.js';
import type { ShapeExtract2TaskInputData } from '@hierarchidb/plugin-service-api';

import { buildExtract2ProgressReporter, resolveRunnableExtract2Tasks } from './resolveRunnableExtract2Tasks.js';
import { runExtract2Adapter } from './runExtract2Adapter.js';
import { defaultStageControls } from '../common/defaultStageControls.js';

export async function runExtract2StageOrchestrator(params: {
  nodeId: NodeId;
  tasks: Extract2Task[];
  inputsByTaskId: Map<string, ShapeExtract2TaskInputData>;

  taskRegistry: {
    registerTasks: (
      stage: 'extract2',
      tasks: Extract2Task[],
      existingTaskIds: Set<string> | undefined,
      inputsByTaskId: Map<string, ShapeExtract2TaskInputData>,
    ) => Promise<void>;
    listStageRecords: (stage: 'extract2') => Promise<Array<{ status: string; message?: string | null }>>;
  };

  adapter: unknown;
  maxConcurrent: number;

  waitIfPaused?: () => Promise<void>;
  getSignal?: () => AbortSignal;

  progressCallback?: (progress: ProgressInfo) => void;

  isSkippedMessage: (message?: string | null) => boolean;

  afterStageCompleted: (args: { total: number; completed: number; failed: number; skipped: number }) => Promise<void>;
}): Promise<void> {
  const defaults = defaultStageControls();
  const {
    nodeId,
    tasks,
    inputsByTaskId,
    taskRegistry,
    adapter,
    maxConcurrent,
    waitIfPaused = defaults.waitIfPaused,
    getSignal = defaults.getSignal,
    progressCallback,
    isSkippedMessage,
    afterStageCompleted,
  } = params;

  await taskRegistry.registerTasks('extract2', tasks, undefined, inputsByTaskId);

  const { runnableTasks, total, baseCompleted, baseFailed, baseDone } = await resolveRunnableExtract2Tasks({
    nodeId,
    taskRegistry: taskRegistry as unknown as Parameters<typeof resolveRunnableExtract2Tasks>[0]['taskRegistry'],
    tasks,
  });

  if (runnableTasks.length === 0) {
    progressCallback?.({
      total,
      completed: baseCompleted,
      failed: baseFailed,
      skipped: 0,
      percentage: total > 0 ? (baseDone / total) * 100 : 0,
      currentStage: 'extract2',
      currentTask: 'Extract2 already completed',
    });

    await afterStageCompleted({
      total,
      completed: baseCompleted,
      failed: baseFailed,
      skipped: 0,
    });
    return;
  }

  const reportProgress = buildExtract2ProgressReporter({
    total,
    baseCompleted,
    baseFailed,
    progressCallback,
  });

  const r = await runExtract2Adapter({
    adapter: adapter as unknown as Parameters<typeof runExtract2Adapter>[0]['adapter'],
    runnableTasks,
    reportProgress,
    waitIfPaused,
    getSignal,
    maxConcurrent,
  });

  const extract2Records = await taskRegistry.listStageRecords('extract2');
  const skipped = extract2Records.filter((task) => isSkippedMessage(task.message)).length;
  const completed = Math.min(total, baseCompleted + r.processed);
  const failed = Math.min(total - completed, baseFailed + r.failed);
  const done = Math.min(total, completed + failed + skipped);

  progressCallback?.({
    total,
    completed,
    failed,
    skipped,
    percentage: total > 0 ? (done / total) * 100 : 0,
    currentStage: 'extract2',
    currentTask: 'Extract2 completed',
  });

  await afterStageCompleted({ total, completed, failed, skipped });
}
