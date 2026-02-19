import type { ShapeBuildTaskSummary } from '../../../atoms/shapeBuildProgressAtoms.js';
import {
  buildVtParentInputSummaryMessage,
  mergeTaskMessage,
  readVtParentInputSummary,
  normalizeTaskStatus,
} from './useShapeBuildTaskSync.task-utils.js';
import type { HandlerRefs } from './useShapeBuildTaskSync.types.js';
import type { RawTaskSummary } from './useShapeBuildTaskSync.types.js';
import { isCompletedAtFullProgress } from './useShapeBuildTaskSync.comparison.utils.js';

type ResolverDeps = {
  sessionNodeId: string | null;
  refs: Pick<HandlerRefs, 'completedTasksRef' | 'vtParentInputDebugLogKeysRef'>;
  resolveTaskStage: (task: RawTaskSummary) => ShapeBuildTaskSummary['stage'];
  resolveProgressValue: (value: unknown) => number;
};

const isDev = import.meta.env.DEV;

export const useShapeBuildTaskSyncResolver = ({
  sessionNodeId,
  refs,
  resolveTaskStage,
  resolveProgressValue,
}: ResolverDeps) => {
  const { completedTasksRef, vtParentInputDebugLogKeysRef } = refs;

  return (task: RawTaskSummary): ShapeBuildTaskSummary => {
    const progress = resolveProgressValue(task.progress);
    const stage = resolveTaskStage(task);
    const normalized: ShapeBuildTaskSummary = {
      ...task,
      stage,
      taskType: stage,
      type: stage,
      status: normalizeTaskStatus(task.status, progress),
      progress: progress >= 100 ? 100 : task.progress,
    };

    if (normalized.stage === 'vt') {
      const parentInputSummary = readVtParentInputSummary(normalized.metadata);
      if (parentInputSummary) {
        const parentInputMessage = buildVtParentInputSummaryMessage(parentInputSummary);
        normalized.message = mergeTaskMessage(normalized.message, parentInputMessage);
        if (isDev) {
          const logKey = `${normalized.taskId}:${parentInputMessage}`;
          if (!vtParentInputDebugLogKeysRef.current.has(logKey)) {
            vtParentInputDebugLogKeysRef.current.add(logKey);
            console.debug('[ShapeVtParentInputSummary]', {
              nodeId: sessionNodeId,
              taskId: normalized.taskId,
              sequence: normalized.sequence ?? null,
              message: parentInputMessage,
              summary: parentInputSummary,
            });
          }
        }
      }
    }

    const completedTask = completedTasksRef.current.get(normalized.taskId);
    if (!completedTask) {
      return normalized;
    }
    if (normalized.status === 'running' || normalized.status === 'queued') {
      return completedTask;
    }
    if (!isCompletedAtFullProgress(normalized)) {
      return completedTask;
    }
    return normalized;
  };
};
