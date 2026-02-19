import type { TaskDisplayPayload, TaskStage } from '@hierarchidb/batch-api';
import {
  compareTaskOrderByIndexThenId,
  readTaskSequence,
  shouldApplyTaskUpdate,
} from '@hierarchidb/ui-batch-progress';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';
import type { RawTaskSummary } from './useShapeBuildTaskSync.types.js';

export const resolveProgressValue = (value: unknown): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : 0
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

export const areTasksEquivalentForView = (
  left: ShapeBuildTaskSummary,
  right: ShapeBuildTaskSummary,
): boolean => (
  left.taskId === right.taskId
  && left.stage === right.stage
  && left.status === right.status
  && resolveProgressValue(left.progress) === resolveProgressValue(right.progress)
  && left.display?.kind === right.display?.kind
  && left.display?.key === right.display?.key
  && left.display?.phaseCode === right.display?.phaseCode
  && left.display?.phaseState === right.display?.phaseState
  && (left.message ?? null) === (right.message ?? null)
  && (left.title ?? null) === (right.title ?? null)
  && (left.error ?? null) === (right.error ?? null)
  && (left.errorMessage ?? null) === (right.errorMessage ?? null)
  && (left.index ?? null) === (right.index ?? null)
  && (left.stagePriority ?? null) === (right.stagePriority ?? null)
  && (left.sequence ?? null) === (right.sequence ?? null)
);

export const resolveTaskStage = (task: RawTaskSummary): TaskStage => {
  const candidates = [task.stage, task.taskType, task.type] as Array<unknown>;
  return candidates.find((candidate) => (
    candidate === 'fetch' || candidate === 'transform' || candidate === 'vt'
  )) as TaskStage;
};

export const isCompletedAtFullProgress = (task: ShapeBuildTaskSummary): boolean => {
  const isCompletedLike = task.status === 'completed' || task.status === 'recycled';
  return isCompletedLike && resolveProgressValue(task.progress) >= 100;
};

const isCompletedLikeStatus = (status: ShapeBuildTaskSummary['status'] | undefined): boolean => (
  status === 'completed' || status === 'recycled'
);

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

const shouldPromoteCompletedMessage = (
  current: ShapeBuildTaskSummary,
  next: ShapeBuildTaskSummary,
): boolean => {
  if (shouldPromoteCompletedDisplay(current, next)) return true;
  const currentMessage = current.message?.trim() ?? '';
  const nextMessage = next.message?.trim() ?? '';
  if (!nextMessage || nextMessage === currentMessage) return false;
  if (!currentMessage) return true;
  const phaseLike = /^[a-z0-9]+(?:[:_-][a-z0-9]+)*$/i;
  if (phaseLike.test(currentMessage) && !phaseLike.test(nextMessage)) return true;
  return false;
};

const readStatusRank = (task: ShapeBuildTaskSummary): number => {
  switch (task.status) {
    case 'queued':
      return 0;
    case 'running':
      return 1;
    case 'paused':
      return 2;
    case 'completed':
    case 'recycled':
    case 'failed':
      return 3;
    default:
      return 0;
  }
};

export const shouldPreferNextTask = (
  current: ShapeBuildTaskSummary,
  next: ShapeBuildTaskSummary,
): boolean => {
  const currentSequence = readTaskSequence(current);
  const nextSequence = readTaskSequence(next);
  if (currentSequence !== null && nextSequence !== null) {
    if (nextSequence < currentSequence) {
      if (
        isCompletedAtFullProgress(next)
        && !isCompletedAtFullProgress(current)
        && (current.status === 'queued' || current.status === 'running')
      ) {
        return true;
      }
      return false;
    }
    if (nextSequence === currentSequence) {
      if (isCompletedAtFullProgress(next) && !isCompletedAtFullProgress(current)) return true;
      if (isCompletedAtFullProgress(current) && !isCompletedAtFullProgress(next)) return false;
      const currentStatusRank = readStatusRank(current);
      const nextStatusRank = readStatusRank(next);
      if (nextStatusRank !== currentStatusRank) return nextStatusRank > currentStatusRank;
      if (resolveProgressValue(next.progress) !== resolveProgressValue(current.progress)) {
        return resolveProgressValue(next.progress) > resolveProgressValue(current.progress);
      }
      if (isCompletedLikeStatus(next.status) && isCompletedLikeStatus(current.status)) {
        return shouldPromoteCompletedMessage(current, next);
      }
      return false;
    }
  }

  if (isCompletedAtFullProgress(current) && isCompletedAtFullProgress(next)) {
    return shouldPromoteCompletedMessage(current, next);
  }
  if (isCompletedAtFullProgress(current) && !isCompletedAtFullProgress(next)) return false;
  if (isCompletedAtFullProgress(next) && !isCompletedAtFullProgress(current)) return true;
  if (isCompletedLikeStatus(current.status) && next.status === 'running') return false;
  if (isCompletedLikeStatus(current.status) && next.status === 'queued') return false;
  if (current.status === 'running' && isCompletedLikeStatus(next.status)) return true;
  if (isCompletedAtFullProgress(current) && isRunningAtFullProgress(next)) return false;
  if (isCompletedAtFullProgress(next) && isRunningAtFullProgress(current)) return true;
  return shouldApplyTaskUpdate(current, next);
};

export const mergeSnapshotWithCurrent = (
  snapshotTasks: ShapeBuildTaskSummary[],
  currentMap: Map<string, ShapeBuildTaskSummary>,
): ShapeBuildTaskSummary[] => {
  if (snapshotTasks.length === 0) return [];
  const mergedMap = new Map<string, ShapeBuildTaskSummary>();
  snapshotTasks.forEach((snapshotTask) => {
    const currentFromMap = currentMap.get(snapshotTask.taskId);
    if (!currentFromMap || shouldPreferNextTask(currentFromMap, snapshotTask)) {
      mergedMap.set(snapshotTask.taskId, snapshotTask);
      return;
    }
    mergedMap.set(snapshotTask.taskId, currentFromMap);
  });
  const merged = [...mergedMap.values()];
  merged.sort(compareTaskOrderByIndexThenId);
  return merged;
};

export const isRunningAtFullProgress = (task: ShapeBuildTaskSummary): boolean => (
  isCompletedAtFullProgress(task)
    ? false
    : task.status === 'running' && resolveProgressValue(task.progress) >= 100
);

export const normalizeTask = (task: RawTaskSummary): ShapeBuildTaskSummary => {
  const progress = resolveProgressValue(task.progress);
  const stage = resolveTaskStage(task);
  return {
    ...task,
    stage,
    taskType: stage,
    type: stage,
    status: task.status === 'running' && progress >= 100 ? 'completed' : task.status,
    progress: progress >= 100 ? 100 : task.progress,
  };
};
