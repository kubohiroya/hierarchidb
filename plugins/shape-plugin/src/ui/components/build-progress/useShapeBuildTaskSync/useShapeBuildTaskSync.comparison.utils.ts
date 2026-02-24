import type { TaskDisplayPayload, TaskStage } from '@hierarchidb/build-api';
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

export const resolveTaskProgress = (
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

export const resolveTaskDisplayStatus = (
  status: ShapeBuildTaskSummary['status'] | undefined,
  progress: number,
  display: ShapeBuildTaskSummary['display'],
  message: ShapeBuildTaskSummary['message'],
): ShapeBuildTaskSummary['status'] => {
  const resolvedStatus = status ?? 'queued';
  if (resolvedStatus === 'running' && progress >= 100) {
    return 'completed';
  }
  if (resolvedStatus === 'running' && isTaskSkipped(display, message)) {
    return 'completed';
  }
  return resolvedStatus;
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
  if (!isTaskStage(task.stage)) {
    throw new Error(`[ShapeBuildTaskSync] invalid task stage: ${String(task.stage)}`);
  }
  const progress = resolveProgressValue(task.progress);
  const stage = task.stage;
  const resolvedStatus = resolveTaskDisplayStatus(task.status, progress, task.display, task.message);
  return {
    ...task,
    stage,
    status: resolvedStatus,
    progress: resolveTaskProgress(resolvedStatus, task.display, task.message, progress),
  };
};

const taskStages = ['fetch', 'transform', 'vt'] as const;

export const isTaskStage = (value: unknown): value is TaskStage => (
  typeof value === 'string' && taskStages.includes(value as TaskStage)
);
