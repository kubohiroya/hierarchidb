import { useCallback, useEffect, useRef } from 'react';
import type { TaskStage } from '@hierarchidb/batch-api';
import type { BuildTaskSummary } from '@hierarchidb/batch-api';
import { shouldApplyTaskUpdate } from '@hierarchidb/ui-batch-progress';
import type { ShapeBuildTaskSummary } from '../../atoms/shapeBuildProgressAtoms.js';

export type RawTaskSummary = BuildTaskSummary & {
  taskType?: string;
  type?: string;
  stage?: string;
  title?: string;
  metadata?: Record<string, unknown>;
  error?: string;
  errorMessage?: string;
  index?: number;
  stagePriority?: number;
  sequence?: number;
  updatedAt?: number;
};

type SyncArgs = {
  setTasks: (tasks: ShapeBuildTaskSummary[]) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
};

const isTaskStage = (value: unknown): value is TaskStage => (
  value === 'fetch' || value === 'transform' || value === 'vt'
);

const resolveTaskStage = (task: RawTaskSummary): TaskStage => {
  const candidate = task.taskType ?? task.type ?? task.stage;
  if (isTaskStage(candidate)) {
    return candidate;
  }
  throw new Error(`[ShapeBuildStep] Invalid task stage: ${String(candidate ?? 'undefined')}`);
};

const resolveProgressValue = (value: number | undefined): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : 0
);

const resolveTaskOrderIndex = (task: ShapeBuildTaskSummary): number => (
  typeof task.index === 'number' && Number.isFinite(task.index)
    ? task.index
    : Number.MAX_SAFE_INTEGER
);

const compareTaskOrder = (left: ShapeBuildTaskSummary, right: ShapeBuildTaskSummary): number => {
  const leftIndex = resolveTaskOrderIndex(left);
  const rightIndex = resolveTaskOrderIndex(right);
  if (leftIndex !== rightIndex) return leftIndex - rightIndex;
  return left.taskId.localeCompare(right.taskId);
};

const findInsertPosition = (items: ShapeBuildTaskSummary[], task: ShapeBuildTaskSummary): number => {
  let low = 0;
  let high = items.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const midTask = items[mid];
    if (!midTask) break;
    if (compareTaskOrder(midTask, task) <= 0) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
};

const upsertTaskInSortedList = (
  current: ShapeBuildTaskSummary[],
  task: ShapeBuildTaskSummary,
): ShapeBuildTaskSummary[] => {
  const existingIndex = current.findIndex((item) => item.taskId === task.taskId);
  if (existingIndex < 0) {
    const insertAt = findInsertPosition(current, task);
    const next = current.slice();
    next.splice(insertAt, 0, task);
    return next;
  }
  const withoutCurrent = current.slice();
  withoutCurrent.splice(existingIndex, 1);
  const insertAt = findInsertPosition(withoutCurrent, task);
  withoutCurrent.splice(insertAt, 0, task);
  return withoutCurrent;
};

const removeTaskFromList = (current: ShapeBuildTaskSummary[], taskId: string): ShapeBuildTaskSummary[] => {
  const index = current.findIndex((task) => task.taskId === taskId);
  if (index < 0) return current;
  const next = current.slice();
  next.splice(index, 1);
  return next;
};

const normalizeTaskStatus = (
  status: ShapeBuildTaskSummary['status'] | undefined,
): ShapeBuildTaskSummary['status'] => (
  status ?? 'queued'
);

const isCompletedAtFullProgress = (task: ShapeBuildTaskSummary): boolean => (
  task.status === 'completed' && resolveProgressValue(task.progress) >= 100
);

const isRunningAtFullProgress = (task: ShapeBuildTaskSummary): boolean => (
  task.status === 'running' && resolveProgressValue(task.progress) >= 100
);

const shouldPreferNextTask = (
  current: ShapeBuildTaskSummary,
  next: ShapeBuildTaskSummary,
): boolean => {
  if (current.status === 'completed' && next.status === 'running') {
    return false;
  }
  if (current.status === 'running' && next.status === 'completed') {
    return true;
  }
  if (isCompletedAtFullProgress(current) && isRunningAtFullProgress(next)) {
    return false;
  }
  if (isCompletedAtFullProgress(next) && isRunningAtFullProgress(current)) {
    return true;
  }
  return shouldApplyTaskUpdate(current, next);
};

export const useShapeBuildTaskSync = ({ setTasks, setIsLoading, setError }: SyncArgs) => {
  const isLoadingRef = useRef(false);
  const errorRef = useRef<Error | null>(null);
  const tasksRef = useRef<ShapeBuildTaskSummary[]>([]);
  const committedTasksRef = useRef<ShapeBuildTaskSummary[]>([]);
  const tasksMapRef = useRef<Map<string, ShapeBuildTaskSummary>>(new Map());
  const pendingTasksRef = useRef<ShapeBuildTaskSummary[] | null>(null);
  const pendingDirtyRef = useRef(false);
  const flushScheduledRef = useRef(false);
  const flushFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      pendingTasksRef.current = null;
      pendingDirtyRef.current = false;
      if (flushFrameRef.current !== null) {
        window.cancelAnimationFrame(flushFrameRef.current);
        flushFrameRef.current = null;
      }
    };
  }, []);

  const flushTasks = useCallback((next: ShapeBuildTaskSummary[], dirty: boolean) => {
    if (!dirty) {
      return;
    }
    committedTasksRef.current = next;
    setTasks(next);
  }, [setTasks]);

  const scheduleFlush = useCallback((next: ShapeBuildTaskSummary[], dirty = true) => {
    pendingTasksRef.current = next;
    pendingDirtyRef.current = pendingDirtyRef.current || dirty;
    if (flushScheduledRef.current) return;
    flushScheduledRef.current = true;
    flushFrameRef.current = window.requestAnimationFrame(() => {
      flushScheduledRef.current = false;
      flushFrameRef.current = null;
      const pending = pendingTasksRef.current;
      const isDirty = pendingDirtyRef.current;
      pendingTasksRef.current = null;
      pendingDirtyRef.current = false;
      if (pending) {
        flushTasks(pending, isDirty);
      }
    });
  }, [flushTasks]);

  const resolveTaskSummary = useCallback((task: RawTaskSummary): ShapeBuildTaskSummary => {
    return {
      ...task,
      stage: resolveTaskStage(task),
      status: normalizeTaskStatus(task.status),
    };
  }, []);

  const mergeTask = useCallback((task: ShapeBuildTaskSummary) => {
    const baseList = pendingTasksRef.current ?? committedTasksRef.current;
    const currentTask = tasksMapRef.current.get(task.taskId);
    if (currentTask && !shouldPreferNextTask(currentTask, task)) {
      return { next: baseList, changed: false } as const;
    }
    const nextMap = new Map(tasksMapRef.current);
    nextMap.set(task.taskId, task);
    tasksMapRef.current = nextMap;
    return { next: upsertTaskInSortedList(baseList, task), changed: true } as const;
  }, []);

  const handleSnapshot = useCallback((next: RawTaskSummary[]) => {
    const resolved = next.map(resolveTaskSummary).sort(compareTaskOrder);
    tasksMapRef.current = new Map(resolved.map((task) => [task.taskId, task]));
    scheduleFlush(resolved, true);
    if (errorRef.current !== null) {
      setError(null);
    }
    if (isLoadingRef.current) {
      setIsLoading(false);
    }
  }, [resolveTaskSummary, scheduleFlush, setError, setIsLoading]);

  const handleUpdate = useCallback((task: RawTaskSummary) => {
    const resolved = resolveTaskSummary(task);
    const result = mergeTask(resolved);
    scheduleFlush(result.next, result.changed);
    if (errorRef.current !== null) {
      setError(null);
    }
    if (isLoadingRef.current) {
      setIsLoading(false);
    }
  }, [mergeTask, resolveTaskSummary, scheduleFlush, setError, setIsLoading]);

  const handleDelete = useCallback((taskId: string) => {
    const existing = tasksMapRef.current.get(taskId);
    if (!existing) {
      scheduleFlush(pendingTasksRef.current ?? committedTasksRef.current, false);
      return;
    }
    const nextMap = new Map(tasksMapRef.current);
    nextMap.delete(taskId);
    tasksMapRef.current = nextMap;
    const current = pendingTasksRef.current ?? committedTasksRef.current;
    const next = removeTaskFromList(current, taskId);
    scheduleFlush(next, true);
    if (errorRef.current !== null) {
      setError(null);
    }
    if (isLoadingRef.current) {
      setIsLoading(false);
    }
  }, [scheduleFlush, setError, setIsLoading]);

  const syncTasksRef = useCallback((tasks: ShapeBuildTaskSummary[]) => {
    tasksRef.current = tasks;
    committedTasksRef.current = tasks;
    tasksMapRef.current = new Map(tasks.map((task) => [task.taskId, task]));
  }, []);

  const syncLoadingRef = useCallback((isLoading: boolean) => {
    isLoadingRef.current = isLoading;
  }, []);

  const syncErrorRef = useCallback((error: Error | null) => {
    errorRef.current = error;
  }, []);

  const resetPending = useCallback(() => {
    pendingTasksRef.current = null;
    pendingDirtyRef.current = false;
  }, []);

  return {
    tasksRef,
    isLoadingRef,
    errorRef,
    handleSnapshot,
    handleUpdate,
    handleDelete,
    syncTasksRef,
    syncLoadingRef,
    syncErrorRef,
    resetPending,
    scheduleFlush,
  };
};
