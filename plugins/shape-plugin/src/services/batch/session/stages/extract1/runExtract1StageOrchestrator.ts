import type { NodeId } from '@hierarchidb/common-types';
import type { Extract1Task, ProgressInfo } from '../../../../../common/types/index.js';
import type { ShapeExtract1TaskInputData } from '@hierarchidb/plugin-service-api';

import { buildExtract1ProgressReporter, resolveRunnableExtract1Tasks } from './resolveRunnableExtract1Tasks.js';
import { runExtract1Adapter } from './runExtract1Adapter.js';

export async function runExtract1StageOrchestrator(params: {
  nodeId: NodeId;
  tasks: Extract1Task[];
  inputsByTaskId: Map<string, ShapeExtract1TaskInputData>;

  taskRegistry: {
    registerTasks: (
      stage: 'extract1',
      tasks: Extract1Task[],
      existingTaskIds: Set<string> | undefined,
      inputsByTaskId: Map<string, ShapeExtract1TaskInputData>,
    ) => Promise<void>;
    listStageRecords: (stage: 'extract1') => Promise<Array<{ status: string; message?: string | null }>>;
  };

  adapter: unknown;
  maxConcurrent: number;

  waitIfPaused: () => Promise<void>;
  getSignal: () => AbortSignal;

  progressCallback?: (progress: ProgressInfo) => void;

  isSkippedMessage: (message?: string | null) => boolean;

  afterStageCompleted: (args: {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
    stageRecords: Array<{ status: string; message?: string | null }>;
  }) => Promise<void>;
}): Promise<void> {
  const {
    nodeId,
    tasks,
    inputsByTaskId,
    taskRegistry,
    adapter,
    maxConcurrent,
    waitIfPaused,
    getSignal,
    progressCallback,
    isSkippedMessage,
    afterStageCompleted,
  } = params;

  await taskRegistry.registerTasks('extract1', tasks, undefined, inputsByTaskId);

  const { runnableTasks, total, baseCompleted, baseFailed, baseDone } = await resolveRunnableExtract1Tasks({
    nodeId,
    taskRegistry: taskRegistry as unknown as Parameters<typeof resolveRunnableExtract1Tasks>[0]['taskRegistry'],
    tasks,
  });

  if (runnableTasks.length === 0) {
    progressCallback?.({
      total,
      completed: baseCompleted,
      failed: baseFailed,
      skipped: 0,
      percentage: total > 0 ? (baseDone / total) * 100 : 0,
      currentStage: 'extract1',
      currentTask: 'Extract1 already completed',
    });

    const stageRecords = await taskRegistry.listStageRecords('extract1');
    const skipped = stageRecords.filter((task) => isSkippedMessage(task.message)).length;
    const completed = stageRecords.filter((task) => task.status === 'completed').length - skipped;
    const failed = stageRecords.filter((task) => task.status === 'failed' || task.status === 'regression').length;

    await afterStageCompleted({
      total,
      completed: Math.max(0, completed),
      failed,
      skipped,
      stageRecords,
    });
    return;
  }

  const reportProgress = buildExtract1ProgressReporter({
    total,
    baseCompleted,
    baseFailed,
    progressCallback,
  });

  await runExtract1Adapter({
    adapter: adapter as unknown as Parameters<typeof runExtract1Adapter>[0]['adapter'],
    runnableTasks,
    reportProgress,
    waitIfPaused,
    getSignal,
    maxConcurrent,
  });

  const stageRecords = await taskRegistry.listStageRecords('extract1');
  const skipped = stageRecords.filter((task) => isSkippedMessage(task.message)).length;
  const failed = stageRecords.filter((task) => task.status === 'failed' || task.status === 'regression').length;
  const completed = Math.max(0, stageRecords.filter((task) => task.status === 'completed').length - skipped);

  await afterStageCompleted({
    total,
    completed,
    failed,
    skipped,
    stageRecords,
  });
}

