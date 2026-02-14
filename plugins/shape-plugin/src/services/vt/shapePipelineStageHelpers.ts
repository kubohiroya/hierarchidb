import type { BuildContinuationPolicy, TaskQueueRecord } from '@hierarchidb/batch-api';
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
  const [queued, running, completed, failed] = await Promise.all([
    listTasksByStageAndStatus(taskQueue, nodeId, stage, 'queued'),
    listTasksByStageAndStatus(taskQueue, nodeId, stage, 'running'),
    listTasksByStageAndStatus(taskQueue, nodeId, stage, 'completed'),
    listTasksByStageAndStatus(taskQueue, nodeId, stage, 'failed'),
  ]);
  return {
    queued: queued.length,
    running: running.length,
    completed: completed.length,
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

const CACHE_REUSE_METADATA_KEY = 'cacheReuse';

const resolveMetadataWithCacheReuse = (metadata: TaskQueueRecord['metadata'] | undefined): Record<string, unknown> => {
  if (metadata && typeof metadata === 'object') {
    const base = metadata as Record<string, unknown>;
    if (base[CACHE_REUSE_METADATA_KEY] === true) {
      return base;
    }
    return { ...base, [CACHE_REUSE_METADATA_KEY]: true };
  }
  return { [CACHE_REUSE_METADATA_KEY]: true };
};

const isCacheReuseMarked = (metadata: TaskQueueRecord['metadata'] | undefined): boolean => {
  if (!metadata || typeof metadata !== 'object') return false;
  return (metadata as Record<string, unknown>)[CACHE_REUSE_METADATA_KEY] === true;
};

export const markStageTasksCacheReused = async (
  taskQueue: VtTaskQueueDb,
  nodeId: NodeId,
  stage: TaskQueueRecord['stage'],
): Promise<void> => {
  const completedTasks = await listTasksByStageAndStatus(taskQueue, nodeId, stage, 'completed');
  if (completedTasks.length === 0) return;
  const updates = completedTasks.map((task) => {
    if (isCacheReuseMarked(task.metadata)) return null;
    return updateTask(taskQueue, task.taskId, {
      metadata: resolveMetadataWithCacheReuse(task.metadata),
    });
  }).filter((update): update is Promise<void> => Boolean(update));
  if (updates.length === 0) return;
  await Promise.all(updates);
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
    progress: 0,
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
): Promise<{ queued: number; running: number }> => {
  const [queuedTasks, runningTasks] = await Promise.all([
    listTasksByStageAndStatus(taskQueue, nodeId, stage, 'queued'),
    listTasksByStageAndStatus(taskQueue, nodeId, stage, 'running'),
  ]);
  if (queuedTasks.length === 0 && runningTasks.length === 0) {
    return { queued: 0, running: 0 };
  }
  const now = Date.now();
  await Promise.all(
    [...queuedTasks, ...runningTasks].map((task) => (
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
    queued: queuedTasks.length,
    running: runningTasks.length,
  }));
  return { queued: queuedTasks.length, running: runningTasks.length };
};
