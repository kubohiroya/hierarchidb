import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';
import {
  buildTileEmitParentInputSummaryMessage,
  mergeTaskMessage,
  readTileEmitParentInputSummary,
  resolveTaskDisplayStatus,
  resolveTaskProgress,
} from './useShapeBuildTaskSync.task-utils.js';
import type { HandlerRefs } from './useShapeBuildTaskSync.types.js';
import type { RawTaskSummary } from './useShapeBuildTaskSync.types.js';
import {
  isCompletedAtFullProgress,
  resolveTaskSummaryFromRaw,
} from './useShapeBuildTaskSync.comparison.utils.js';
import { isTaskSkipped, resolveTaskMetadataMessage } from '~/common/utils/taskMessages';
import { isTileEmitLikeStageId } from '~/ui/components/build-progress/stageIdAliases';

const resolveTaskMetadataText = (task: ReturnType<typeof resolveTaskSummaryFromRaw>): string => {
  const metadataMessage = resolveTaskMetadataMessage(task.metadata)?.trim();
  if (metadataMessage) return metadataMessage;
  const rawMessage = (task as { message?: unknown }).message;
  if (typeof rawMessage === 'string') {
    const trimmed = rawMessage.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return '';
};

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
    const metadataMessage = resolveTaskMetadataText(normalizedTask);
    const resolvedStatus = resolveTaskDisplayStatus(
      normalizedTask.status,
      progress,
      normalizedTask.display,
      metadataMessage,
    );
    const resolvedTask: ShapeBuildTaskSummary = {
      ...normalizedTask,
      status: resolvedStatus,
      progress: resolveTaskProgress(resolvedStatus, normalizedTask.display, metadataMessage, progress),
    };
    const rawRetryAttempt = resolveNumberFromMetadata(resolvedTask.metadata?.retryAttempt);
    if (rawRetryAttempt !== null && Number.isFinite(rawRetryAttempt) && rawRetryAttempt >= 0) {
      resolvedTask.retryAttempt = Math.floor(rawRetryAttempt);
    }

    const resolvedStageId = resolvedTask.stageId ?? resolvedTask.stage;
    if (isTileEmitLikeStageId(resolvedStageId)) {
      const parentInputSummary = readTileEmitParentInputSummary(resolvedTask.metadata);
      if (parentInputSummary) {
        const parentInputMessage = buildTileEmitParentInputSummaryMessage(parentInputSummary);
        const baseMessage = resolveTaskMetadataText(resolvedTask);
        const mergedMessage = mergeTaskMessage(baseMessage, parentInputMessage);
        resolvedTask.metadata = {
          ...(resolvedTask.metadata ?? {}),
          message: mergedMessage,
        };
        if (isDev) {
          const logKey = `${resolvedTask.taskId}:${parentInputMessage}`;
          if (!vtParentInputDebugLogKeysRef.current.has(logKey)) {
            vtParentInputDebugLogKeysRef.current.add(logKey);
            console.debug('[ShapeTileEmitParentInputSummary]', {
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
        || isTaskSkipped(completedTask.display, resolveTaskMetadataMessage(completedTask.metadata) ?? null);
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
