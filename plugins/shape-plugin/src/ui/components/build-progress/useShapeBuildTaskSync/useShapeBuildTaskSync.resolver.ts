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
import { isCompletedAtFullProgress } from './useShapeBuildTaskSync.comparison.utils.js';

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

  return (task: RawTaskSummary): ShapeBuildTaskSummary => {
    const progress = resolveProgressValue(task.progress);
    const stage = task.stage;
    const resolvedStatus = resolveTaskDisplayStatus(task.status, progress, task.display, task.message);
    const resolvedTask: ShapeBuildTaskSummary = {
      ...task,
      stage,
      status: resolvedStatus,
      progress: resolveTaskProgress(resolvedStatus, progress, task.display, task.message),
    };

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
      return completedTask;
    }
    if (!isCompletedAtFullProgress(resolvedTask)) {
      return completedTask;
    }
    return resolvedTask;
  };
};
