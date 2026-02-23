import type { TaskDisplayPayload, TaskStage } from '../../../../../../../packages/build-api';
import { compareTaskOrderByIndexThenId } from '../../../../../../../packages/ui/build-sessions';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';
import type { RawTaskSummary } from './useShapeBuildTaskSync.types.js';
import { isTaskSkipped } from '~/common/utils/taskMessages';

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
);

export const resolveTaskStage = (task: RawTaskSummary): TaskStage => {
  const candidates = [task.stage] as Array<unknown>;
  return candidates.find((candidate) => (
    candidate === 'fetch' || candidate === 'transform' || candidate === 'vt'
  )) as TaskStage;
};

export const isCompletedAtFullProgress = (task: ShapeBuildTaskSummary): boolean => {
  if (!isTerminalTask(task)) return false;
  return resolveProgressValue(task.progress) >= 100;
};

export const isTerminalTask = (task: ShapeBuildTaskSummary | undefined): boolean => (
  isTerminalTaskStatus(task?.status) || isTaskSkipped(task?.display, task?.message)
);

const isTerminalTaskStatus = (status: ShapeBuildTaskSummary['status'] | undefined): boolean => (
  status === 'completed' || status === 'failed'
);

const isTerminalStatus = (task: ShapeBuildTaskSummary | undefined): boolean => (
  isTerminalTask(task)
);

export const normalizeTaskProgress = (
  status: ShapeBuildTaskSummary['status'] | undefined,
  display: ShapeBuildTaskSummary['display'],
  message: ShapeBuildTaskSummary['message'],
  progress: number,
): number => {
  if (isTerminalTaskStatus(status) || isTaskSkipped(display, message)) {
    return 100;
  }
  if (status === 'running' && progress >= 100) {
    return 100;
  }
  if (!Number.isFinite(progress)) {
    return 0;
  }
  if (progress < 0) {
    return 0;
  }
  return progress >= 100 ? 99 : progress;
};

export const normalizeTaskStatus = (
  status: ShapeBuildTaskSummary['status'] | undefined,
  progress: number,
  display: ShapeBuildTaskSummary['display'],
  message: ShapeBuildTaskSummary['message'],
): ShapeBuildTaskSummary['status'] => {
  const normalizedStatus = status ?? 'queued';
  if (normalizedStatus === 'running' && progress >= 100) {
    return 'completed';
  }
  if (normalizedStatus === 'running' && isTaskSkipped(display, message)) {
    return 'completed';
  }
  return normalizedStatus;
};

const shouldApplyTaskUpdate = (
  current: ShapeBuildTaskSummary | undefined,
  next: ShapeBuildTaskSummary,
): boolean => {
  if (!current) return true;
  if (isTerminalStatus(current) && !isTerminalStatus(next)) {
    return false;
  }
  const currentProgress = resolveProgressValue(current.progress);
  const nextProgress = resolveProgressValue(next.progress);
  if (nextProgress < currentProgress) return false;
  if (nextProgress === currentProgress) {
    if (current.status === next.status) return false;
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
    return nextRank > currentRank;
  }
  return true;
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
  const currentMessage = current.message?.trim() ?? '';
  const nextMessage = next.message?.trim() ?? '';
  if (!nextMessage || nextMessage === currentMessage) return false;
  return true;
};

const shouldPromoteCompletedMessage = (
  current: ShapeBuildTaskSummary,
  next: ShapeBuildTaskSummary,
): boolean => {
  if (shouldPromoteCompletedDisplay(current, next)) return true;
  if (current.status === 'failed' && next.status === 'failed') {
    return shouldPromoteFailedMessage(current, next);
  }
  if (current.status !== 'failed' && next.status === 'failed') {
    return true;
  }
  const currentMessage = current.message?.trim() ?? '';
  const nextMessage = next.message?.trim() ?? '';
  if (!nextMessage || nextMessage === currentMessage) return false;
  if (!currentMessage) return true;
  const phaseLike = /^[a-z0-9]+(?:[:_-][a-z0-9]+)*$/i;
  if (phaseLike.test(currentMessage) && !phaseLike.test(nextMessage)) return true;
  return false;
};

export const shouldPreferNextTask = (
  current: ShapeBuildTaskSummary,
  next: ShapeBuildTaskSummary,
): boolean => {
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

export const reconcileSnapshotWithCurrentTasks = (
  snapshotTasks: ShapeBuildTaskSummary[],
  currentMap: Map<string, ShapeBuildTaskSummary>,
): ShapeBuildTaskSummary[] => {
  if (snapshotTasks.length === 0) {
    // If the bridge momentarily emits an empty snapshot while tasks are still in-flight,
    // keep existing in-progress tasks to avoid a UI flash that clears the task list.
    const hasInFlightTask = [...currentMap.values()].some(
      (task) => task.status === 'running' || task.status === 'queued',
    );
    if (!hasInFlightTask) return [];
    const fallback = [...currentMap.values()];
    fallback.sort(compareTaskOrderByIndexThenId);
    return fallback;
  }

  const mergedMap = new Map<string, ShapeBuildTaskSummary>(currentMap);
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

export const normalizeTask = (task: RawTaskSummary): ShapeBuildTaskSummary => {
  const progress = resolveProgressValue(task.progress);
  const stage = resolveTaskStage(task);
  const normalizedStatus = normalizeTaskStatus(task.status, progress, task.display, task.message);
  return {
    ...task,
    stage,
    status: normalizedStatus,
    progress: normalizeTaskProgress(normalizedStatus, task.display, task.message, progress),
  };
};
