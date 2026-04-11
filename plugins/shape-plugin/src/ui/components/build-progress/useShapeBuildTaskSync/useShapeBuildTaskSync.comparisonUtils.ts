import type { TaskDisplayPayload, TaskStage } from '@hierarchidb/build-api';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressTypes';
import type { RawTaskSummary } from './useShapeBuildTaskSyncTypes.js';
import { resolveTaskMetadataMessage } from '~/common/utils/taskMessageUtils';
import { isTaskSkipped } from '~/common/utils/taskMessageUtils';
import { normalizeUiStageId, toLegacyUiStageId } from '~/ui/components/build-progress/stageIdAliases';

const isValidProgressValue = (value: unknown): value is number => (
  typeof value === 'number'
  && Number.isFinite(value)
  && value >= 0
  && value <= 100
);

const assertValidProgressValue = (value: unknown, context: string): number => {
  if (!isValidProgressValue(value)) {
    throw new Error(`[ShapeBuildTaskSync] invalid progress (${context}): ${String(value)}`);
  }
  return value;
};

const assertValidTaskVersion = (value: unknown, context: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`[ShapeBuildTaskSync] invalid version (${context}): ${String(value)}`);
  }
  const rounded = Math.floor(value);
  if (rounded < 1) {
    throw new Error(`[ShapeBuildTaskSync] invalid version (${context}): ${String(value)}`);
  }
  return rounded;
};

export const resolveProgressValue = (value: unknown): number => (
  assertValidProgressValue(value, 'raw')
);

export const areTaskListsEquivalentForView = (
  left: ShapeBuildTaskSummary[],
  right: ShapeBuildTaskSummary[],
): boolean => {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const leftTask = left[index];
    const rightTask = right[index];
    if (!leftTask || !rightTask) return false;
    if (!areTasksEquivalentForView(leftTask, rightTask)) return false;
  }
  return true;
};

const areMetadataEquivalentForView = (
  left: Record<string, unknown> | undefined,
  right: Record<string, unknown> | undefined,
): boolean => {
  if (left === right) return true;
  if (!left || !right) {
    return left === undefined && right === undefined;
  }
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => Object.hasOwn(right, key) && right[key] === left[key]);
};

const resolveTaskMetadataText = (task: ShapeBuildTaskSummary): string => {
  const metadataMessage = resolveTaskMetadataMessage(task.metadata)?.trim();
  if (metadataMessage) return metadataMessage;
  const rawMessage = (task as { message?: unknown }).message;
  if (typeof rawMessage === 'string') {
    const trimmed = rawMessage.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return '';
};

const normalizeTaskMetadata = (
  metadata: Record<string, unknown> | undefined,
  message: unknown,
): Record<string, unknown> | undefined => {
  if (typeof message !== 'string' || message.trim().length === 0) {
    return metadata;
  }
  const trimmed = message.trim();
  if (metadata && typeof metadata === 'object') {
    const existing = typeof metadata.message === 'string' ? metadata.message.trim() : '';
    if (existing.length > 0) {
      return metadata;
    }
    return { ...metadata, message: trimmed };
  }
  return { message: trimmed };
};

export const areTasksEquivalentForView = (
  left: ShapeBuildTaskSummary,
  right: ShapeBuildTaskSummary,
): boolean => (
  left.taskId === right.taskId
  && left.stage === right.stage
  && assertValidTaskVersion(left.version, 'view:left') === assertValidTaskVersion(right.version, 'view:right')
  && left.status === right.status
  && resolveProgressValue(left.progress) === resolveProgressValue(right.progress)
  && left.display?.kind === right.display?.kind
  && left.display?.key === right.display?.key
  && left.display?.phaseCode === right.display?.phaseCode
  && left.display?.phaseState === right.display?.phaseState
  && resolveTaskMetadataText(left) === resolveTaskMetadataText(right)
  && (left.retryAttempt ?? null) === (right.retryAttempt ?? null)
  && (left.title ?? null) === (right.title ?? null)
  && (left.error ?? null) === (right.error ?? null)
  && (left.errorMessage ?? null) === (right.errorMessage ?? null)
  && areMetadataEquivalentForView(left.metadata, right.metadata)
  && (left.index ?? null) === (right.index ?? null)
  && (left.stagePriority ?? null) === (right.stagePriority ?? null)
);

export const isCompletedAtFullProgress = (task: ShapeBuildTaskSummary): boolean => {
  if (!isTerminalTask(task)) return false;
  return resolveProgressValue(task.progress) >= 100;
};

export const isTerminalTask = (task: ShapeBuildTaskSummary | undefined): boolean => (
  isTerminalTaskStatus(task?.status) || isTaskSkipped(task?.display, task ? resolveTaskMetadataText(task) : null)
);

const isTerminalTaskStatus = (status: ShapeBuildTaskSummary['status'] | undefined): boolean => (
  status === 'completed' || status === 'failed'
);

const isTerminalStatus = (task: ShapeBuildTaskSummary | undefined): boolean => (
  isTerminalTask(task)
);

export const resolveTaskProgress = (
  status: ShapeBuildTaskSummary['status'] | undefined,
  display: ShapeBuildTaskSummary['display'],
  _message: string,
  progress: number,
): number => {
  const normalizedProgress = assertValidProgressValue(progress, 'resolved');
  if (isTerminalTaskStatus(status) || isTaskSkipped(display, _message)) {
    return 100;
  }
  if (status !== 'running' && normalizedProgress >= 100) {
    throw new Error(`[ShapeBuildTaskSync] non-running task reached 100 progress: status=${String(status)}`);
  }
  return normalizedProgress;
};

export const resolveTaskDisplayStatus = (
  status: ShapeBuildTaskSummary['status'] | undefined,
  progress: number,
  display: ShapeBuildTaskSummary['display'],
  _message: string,
): ShapeBuildTaskSummary['status'] => {
  const normalizedProgress = assertValidProgressValue(progress, 'status');
  const resolvedStatus = status ?? 'queued';
  if (resolvedStatus === 'running' && normalizedProgress >= 100) {
    return 'completed';
  }
  if (resolvedStatus === 'running' && isTaskSkipped(display, _message)) {
    return 'completed';
  }
  return resolvedStatus;
};

const shouldApplyTaskUpdate = (
  current: ShapeBuildTaskSummary | undefined,
  next: ShapeBuildTaskSummary,
): boolean => {
  if (!current) return true;
  const currentVersion = assertValidTaskVersion(current.version, 'current');
  const nextVersion = assertValidTaskVersion(next.version, 'next');
  if (nextVersion < currentVersion) return false;
  if (nextVersion > currentVersion) return true;
  if (isTerminalStatus(current) && !isTerminalStatus(next)) {
    return false;
  }
  if (current.status === next.status) return true;
  const statusRank: Record<ShapeBuildTaskSummary['status'], number> = {
    idle: 0,
    queued: 1,
    paused: 2,
    recycled: 3,
    running: 4,
    completed: 5,
    failed: 6,
  };
  const currentRank = statusRank[current.status] ?? 0;
  const nextRank = statusRank[next.status] ?? 0;
  return nextRank >= currentRank;
};

const areDisplaysEqual = (
  left: TaskDisplayPayload | undefined,
  right: TaskDisplayPayload | undefined,
): boolean => {
  if (left === right) return true;
  if (!left || !right) return false;
  const leftParams = left.params;
  const rightParams = right.params;
  const leftKeys = leftParams ? Object.keys(leftParams) : [];
  const rightKeys = rightParams ? Object.keys(rightParams) : [];
  if (leftKeys.length !== rightKeys.length) return false;
  if (left.kind !== right.kind) return false;
  if (left.key !== right.key) return false;
  if (left.phaseCode !== right.phaseCode) return false;
  if (left.phaseState !== right.phaseState) return false;
  return leftKeys.every((key) => leftParams?.[key] === rightParams?.[key]);
};

const shouldPromoteCompletedDisplay = (
  current: ShapeBuildTaskSummary,
  next: ShapeBuildTaskSummary,
): boolean => {
  if (areDisplaysEqual(current.display, next.display)) return false;
  if (!current.display && next.display) return true;
  if (current.display && !next.display) return false;
  if (
    current.display?.kind === 'phase' && current.display?.phaseCode && next.display
    && next.display.kind !== 'phase'
  ) {
    return true;
  }
  return false;
};

const shouldPromoteFailedMessage = (
  current: ShapeBuildTaskSummary,
  next: ShapeBuildTaskSummary,
): boolean => {
  const currentMessage = resolveTaskMetadataText(current);
  const nextMessage = resolveTaskMetadataText(next);
  if (!nextMessage || nextMessage === currentMessage) return false;
  return true;
};

const shouldPromoteCompletedMessage = (
  current: ShapeBuildTaskSummary,
  next: ShapeBuildTaskSummary,
): boolean => {
  if (!areMetadataEquivalentForView(current.metadata, next.metadata)) return true;
  if (shouldPromoteCompletedDisplay(current, next)) return true;
  if (current.status === 'failed' && next.status === 'failed') {
    return shouldPromoteFailedMessage(current, next);
  }
  if (current.status !== 'failed' && next.status === 'failed') {
    return true;
  }
  const currentMessage = resolveTaskMetadataText(current);
  const nextMessage = resolveTaskMetadataText(next);
  if (!nextMessage || nextMessage === currentMessage) return false;
  if (!currentMessage) return true;
  const phaseLike = /^[a-z0-9]+(?:[:_-][a-z0-9]+)*$/i;
  if (phaseLike.test(currentMessage) && !phaseLike.test(nextMessage)) return true;
  return false;
};

const isRetryableTerminalTask = (task: ShapeBuildTaskSummary): boolean => (
  task.status === 'failed'
  || isTaskSkipped(task.display, resolveTaskMetadataText(task))
);

export const shouldPreferNextTask = (
  current: ShapeBuildTaskSummary,
  next: ShapeBuildTaskSummary,
): boolean => {
  if (isRetryableTerminalTask(current) && (next.status === 'queued' || next.status === 'running')) {
    return true;
  }
  if (isCompletedAtFullProgress(current) && isCompletedAtFullProgress(next)) {
    return shouldPromoteCompletedMessage(current, next);
  }
  if (isCompletedAtFullProgress(current) && !isCompletedAtFullProgress(next)) return false;
  if (isCompletedAtFullProgress(next) && !isCompletedAtFullProgress(current)) return true;
  if (isTerminalStatus(current) && !isTerminalStatus(next)) return false;
  if (!isTerminalStatus(current) && isTerminalStatus(next)) return true;
  if (isTerminalStatus(current) && isTerminalStatus(next)) {
    if (current.status !== next.status) return false;
    return shouldPromoteCompletedMessage(current, next);
  }
  return shouldApplyTaskUpdate(current, next);
};

export const replaceSnapshotAndPreserveNonIncomingStages = (
  snapshotTasks: ShapeBuildTaskSummary[],
  currentMap: Map<string, ShapeBuildTaskSummary>,
): ShapeBuildTaskSummary[] => {
  if (snapshotTasks.length === 0) {
    return [...currentMap.values()];
  }

  const dedupedSnapshot = dedupeTasks(snapshotTasks);
  const snapshotMap = new Map(dedupedSnapshot.map((task) => [task.taskId, task]));
  const currentTasks = [...currentMap.values()];
  const next: ShapeBuildTaskSummary[] = [];
  const includedTaskIds = new Set<string>();

  currentTasks.forEach((task) => {
    const nextTask = snapshotMap.get(task.taskId);
    if (!nextTask) {
      next.push(task);
      return;
    }
    next.push(nextTask);
    includedTaskIds.add(task.taskId);
  });

  dedupedSnapshot.forEach((task) => {
    if (!currentMap.has(task.taskId) && !includedTaskIds.has(task.taskId)) {
      next.push(task);
      includedTaskIds.add(task.taskId);
    }
  });

  return next;
};

export const replaceSnapshotTasks = (snapshotTasks: ShapeBuildTaskSummary[]): ShapeBuildTaskSummary[] => (
  dedupeTasks(snapshotTasks)
);

const dedupeTasks = (snapshotTasks: ShapeBuildTaskSummary[]): ShapeBuildTaskSummary[] => {
  const next: ShapeBuildTaskSummary[] = [];
  const indexByTaskId = new Map<string, number>();
  snapshotTasks.forEach((task) => {
    const currentIndex = indexByTaskId.get(task.taskId);
    if (currentIndex === undefined) {
      indexByTaskId.set(task.taskId, next.length);
      next.push(task);
      return;
    }
    next[currentIndex] = task;
  });
  return next;
};

export const replaceSnapshotAndPreserveCurrentTasksByStage = (
  snapshotTasks: ShapeBuildTaskSummary[],
  currentTasks: ShapeBuildTaskSummary[],
): ShapeBuildTaskSummary[] => (
  replaceSnapshotAndPreserveNonIncomingStages(
    snapshotTasks,
    new Map(currentTasks.map((task) => [task.taskId, task])),
  )
);

export const resolveTaskSummaryFromRaw = (task: RawTaskSummary): ShapeBuildTaskSummary => {
  const stage = resolveTaskStage(task);
  const version = assertValidTaskVersion(task.version, 'raw');
  const rawMessage = (task as { message?: unknown }).message;
  const normalizedMetadata = normalizeTaskMetadata(task.metadata, rawMessage);
  const progress = resolveProgressValue(task.progress);
  const metadataMessage = resolveTaskMetadataMessage(normalizedMetadata) ?? '';
  const resolvedStatus = resolveTaskDisplayStatus(task.status, progress, task.display, metadataMessage);
  return {
    ...task,
    version,
    stage,
    status: resolvedStatus,
    progress: resolveTaskProgress(resolvedStatus, task.display, metadataMessage, progress),
    metadata: normalizedMetadata,
  };
};

export const resolveTaskStageFromRaw = (task: RawTaskSummary): TaskStage => resolveTaskStage(task);

const taskStages = ['source', 'geometry', 'tileEmit'] as const;

export const resolveTaskStage = (task: RawTaskSummary): TaskStage => {
  const canonicalFromStageId = normalizeUiStageId(task.stageId);
  if (canonicalFromStageId) {
    const canonicalFromStage = normalizeUiStageId(task.stage);
    if (canonicalFromStage && canonicalFromStage !== canonicalFromStageId) {
      console.warn('[ShapeBuildTaskSync] normalize task stage by stageId precedence', {
        taskId: task.taskId,
        stage: task.stage,
        stageId: task.stageId,
        resolvedStage: canonicalFromStageId,
      });
    } else if (task.stage !== toLegacyUiStageId(canonicalFromStageId)) {
      console.warn('[ShapeBuildTaskSync] normalize task stage from stageId', {
        taskId: task.taskId,
        stage: task.stage,
        stageId: task.stageId,
        resolvedStage: canonicalFromStageId,
      });
    }
    return toLegacyUiStageId(canonicalFromStageId);
  }

  const canonicalFromStage = normalizeUiStageId(task.stage);
  if (canonicalFromStage) {
    return toLegacyUiStageId(canonicalFromStage);
  }

  const taskId = typeof task.taskId === 'string' ? task.taskId : '';
  const canonicalFromTaskId = normalizeUiStageId(taskId);
  if (canonicalFromTaskId) {
    if (normalizeUiStageId(task.stage) !== canonicalFromTaskId) {
      console.warn('[ShapeBuildTaskSync] normalize task stage from taskId', {
        taskId,
        stage: task.stage,
        resolvedStage: canonicalFromTaskId,
      });
    }
    return toLegacyUiStageId(canonicalFromTaskId);
  }

  throw new Error('invalid task stage');
};

export const isTaskStage = (value: unknown): value is TaskStage => (
  typeof value === 'string' && taskStages.includes(value as TaskStage)
);
