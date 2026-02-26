import type { BuildContinuationPolicy, TaskQueueRecord } from '@hierarchidb/build-api';
import type { NodeId } from '@hierarchidb/core-types';
import { listTasksByStageAndStatus, updateTask, VtTaskQueueDb } from '@hierarchidb/vt-orchestrator';

export type StageCounts = {
  queued: number;
  running: number;
  completed: number;
  failed: number;
};

export const resolveFailureHandling = (policy: BuildContinuationPolicy): 'continue' | 'stop' => (
  policy === 'stop_on_first_error' ? 'stop' : 'continue'
);

export const shouldStopAfterStage = (policy: BuildContinuationPolicy, failedCount: number): boolean => (
  failedCount > 0 && policy !== 'finish_all_stages'
);

export const getFailedTaskCount = async (
  taskQueue: VtTaskQueueDb,
  nodeId: NodeId,
  stage: TaskQueueRecord['stage'],
): Promise<number> => {
  const failed = await listTasksByStageAndStatus(taskQueue, nodeId, stage, 'failed');
  return failed.length;
};

export const summarizeStageCounts = async (
  taskQueue: VtTaskQueueDb,
  nodeId: NodeId,
  stage: TaskQueueRecord['stage'],
): Promise<StageCounts> => {
  const [queued, running, completed, failed, recycled] = await Promise.all([
    listTasksByStageAndStatus(taskQueue, nodeId, stage, 'queued'),
    listTasksByStageAndStatus(taskQueue, nodeId, stage, 'running'),
    listTasksByStageAndStatus(taskQueue, nodeId, stage, 'completed'),
    listTasksByStageAndStatus(taskQueue, nodeId, stage, 'failed'),
    listTasksByStageAndStatus(taskQueue, nodeId, stage, 'recycled'),
  ]);
  return {
    queued: queued.length,
    running: running.length,
    completed: completed.length + recycled.length,
    failed: failed.length,
  };
};

export const readHeapSnapshot = () => {
  const performance = (globalThis as {
    performance?: {
      memory?: {
        usedJSHeapSize?: number;
        totalJSHeapSize?: number;
        jsHeapSizeLimit?: number;
      };
    };
  }).performance;
  const memory = performance?.memory;
  if (!memory) return null;
  return {
    used: memory.usedJSHeapSize ?? null,
    total: memory.totalJSHeapSize ?? null,
    limit: memory.jsHeapSizeLimit ?? null,
  };
};

export const markStageTasksRecycled = async (
  taskQueue: VtTaskQueueDb,
  nodeId: NodeId,
  stage: TaskQueueRecord['stage'],
): Promise<void> => {
  const completedTasks = await listTasksByStageAndStatus(taskQueue, nodeId, stage, 'completed');
  if (completedTasks.length === 0) return;
  const now = Date.now();
  await Promise.all(
    completedTasks.map((task) => updateTask(
      taskQueue,
      task.taskId,
      {
        status: 'recycled',
        progress: 100,
        completedAt: task.completedAt ?? now,
      },
      { allowTerminalStatusTransition: true },
    )),
  );
};

export const resetStageRunningTasks = async (
  taskQueue: VtTaskQueueDb,
  nodeId: NodeId,
  stage: TaskQueueRecord['stage'],
): Promise<void> => {
  const runningTasks = await listTasksByStageAndStatus(taskQueue, nodeId, stage, 'running');
  if (runningTasks.length === 0) return;
  console.warn('[ShapePipeline] resetting stale running tasks', {
    nodeId,
    stage,
    count: runningTasks.length,
  });
  await Promise.all(runningTasks.map((task) => updateTask(taskQueue, task.taskId, {
    status: 'queued',
    startedAt: undefined,
    completedAt: undefined,
    errorMessage: undefined,
    message: undefined,
    outputData: undefined,
  })));
};

export const finalizePendingStageTasks = async (
  taskQueue: VtTaskQueueDb,
  nodeId: NodeId,
  stage: TaskQueueRecord['stage'],
  errorMessage: string,
  logLabel: string,
  pipelineRunId?: string,
): Promise<{ queued: number; running: number; authPending: number }> => {
  const [queuedTasks, runningTasks] = await Promise.all([
    listTasksByStageAndStatus(taskQueue, nodeId, stage, 'queued'),
    listTasksByStageAndStatus(taskQueue, nodeId, stage, 'running'),
  ]);
  if (queuedTasks.length === 0 && runningTasks.length === 0) {
    return { queued: 0, running: 0, authPending: 0 };
  }
  const pendingTasks = [...queuedTasks, ...runningTasks];
  const authPendingTasks = pendingTasks.filter((task) => {
    const metadata = task.metadata;
    if (!metadata || typeof metadata !== 'object') return false;
    const authState = (metadata as { authState?: unknown }).authState;
    return authState === 'required';
  });
  const finalizeTargets = pendingTasks.filter((task) => !authPendingTasks.includes(task));
  const now = Date.now();
  await Promise.all(
    finalizeTargets.map((task) => (
      updateTask(taskQueue, task.taskId, {
        status: 'failed',
        message: errorMessage,
        errorMessage,
        completedAt: now,
      })
    )),
  );
  console.warn(logLabel, JSON.stringify({
    nodeId,
    runId: pipelineRunId ?? null,
    queued: finalizeTargets.filter((task) => task.status === 'queued').length,
    running: finalizeTargets.filter((task) => task.status === 'running').length,
    authPending: authPendingTasks.length,
  }));
  return {
    queued: finalizeTargets.filter((task) => task.status === 'queued').length,
    running: finalizeTargets.filter((task) => task.status === 'running').length,
    authPending: authPendingTasks.length,
  };
};
