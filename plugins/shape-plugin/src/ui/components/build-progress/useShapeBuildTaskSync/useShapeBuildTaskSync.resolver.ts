import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';
import {
  buildVtParentInputSummaryMessage,
  mergeTaskMessage,
  readVtParentInputSummary,
  resolveTaskDisplayStatus,
  resolveTaskProgress,
} from './useShapeBuildTaskSync.task-utils.js';
import type { HandlerRefs } from './useShapeBuildTaskSync.types.js';
import type { RawTaskSummary } from './useShapeBuildTaskSync.types.js';
import {
  isCompletedAtFullProgress,
  resolveTaskSummaryFromRaw,
} from './useShapeBuildTaskSync.comparison.utils.js';
import { isTaskSkipped } from '~/common/utils/taskMessages';

type ResolverDeps = {
  sessionNodeId: string | null;
  refs: Pick<
    HandlerRefs,
    'completedTasksRef' | 'vtParentInputDebugLogKeysRef'
  >;
  resolveProgressValue: (value: unknown) => number;
};

const isDev = import.meta.env.DEV;

export const useShapeBuildTaskSyncResolver = ({
  sessionNodeId,
  refs,
  resolveProgressValue,
}: ResolverDeps) => {
  const { completedTasksRef, vtParentInputDebugLogKeysRef } = refs;
  const resolveNumberFromMetadata = (rawValue: unknown): number | null => {
    if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      return rawValue;
    }
    if (typeof rawValue === 'string') {
      const parsed = Number.parseFloat(rawValue);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  return (task: RawTaskSummary): ShapeBuildTaskSummary => {
    const normalizedTask = resolveTaskSummaryFromRaw(task);
    const progress = resolveProgressValue(normalizedTask.progress);
    const resolvedStatus = resolveTaskDisplayStatus(
      normalizedTask.status,
      progress,
      normalizedTask.display,
      normalizedTask.message,
    );
    const resolvedTask: ShapeBuildTaskSummary = {
      ...normalizedTask,
      status: resolvedStatus,
      progress: resolveTaskProgress(resolvedStatus, progress, normalizedTask.display, normalizedTask.message),
    };
    const rawRetryAttempt = resolveNumberFromMetadata(resolvedTask.metadata?.retryAttempt);
    if (rawRetryAttempt !== null && Number.isFinite(rawRetryAttempt) && rawRetryAttempt >= 0) {
      resolvedTask.retryAttempt = Math.floor(rawRetryAttempt);
    }

    if (resolvedTask.stage === 'vt') {
      const parentInputSummary = readVtParentInputSummary(resolvedTask.metadata);
      if (parentInputSummary) {
        const parentInputMessage = buildVtParentInputSummaryMessage(parentInputSummary);
        resolvedTask.message = mergeTaskMessage(resolvedTask.message, parentInputMessage);
        if (isDev) {
          const logKey = `${resolvedTask.taskId}:${parentInputMessage}`;
          if (!vtParentInputDebugLogKeysRef.current.has(logKey)) {
            vtParentInputDebugLogKeysRef.current.add(logKey);
            console.debug('[ShapeVtParentInputSummary]', {
              nodeId: sessionNodeId,
              taskId: resolvedTask.taskId,
              message: parentInputMessage,
              summary: parentInputSummary,
            });
          }
        }
      }
    }

    const completedTask = completedTasksRef.current.get(resolvedTask.taskId);
    if (!completedTask) {
      return resolvedTask;
    }
    if (resolvedTask.status === 'running' || resolvedTask.status === 'queued') {
      const isRetryableCompletedTask = completedTask.status === 'failed'
        || isTaskSkipped(completedTask.display, completedTask.message);
      if (isRetryableCompletedTask) {
        return resolvedTask;
      }
      return completedTask;
    }
    if (!isCompletedAtFullProgress(resolvedTask)) {
      return completedTask;
    }
    return resolvedTask;
  };
};
