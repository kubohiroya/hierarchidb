import { useCallback, useEffect, useRef } from 'react';
import type { TaskStage } from '@hierarchidb/batch-api';
import type { BatchTaskSummary } from '@hierarchidb/batch-api';
import {
  areTaskListsEqual,
  shouldApplyTaskUpdate,
  sortTasksByIndex,
} from '@hierarchidb/ui-batch-progress';
import type { ShapeBuildTaskSummary } from '../../atoms/shapeBuildProgressAtoms.js';

export type RawTaskSummary = BatchTaskSummary & {
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

export const useShapeBuildTaskSync = ({ setTasks, setIsLoading, setError }: SyncArgs) => {
  const isLoadingRef = useRef(false);
  const errorRef = useRef<Error | null>(null);
  const tasksRef = useRef<ShapeBuildTaskSummary[]>([]);
  const committedTasksRef = useRef<ShapeBuildTaskSummary[]>([]);
  const tasksMapRef = useRef<Map<string, ShapeBuildTaskSummary>>(new Map());
  const pendingTasksRef = useRef<ShapeBuildTaskSummary[] | null>(null);
  const pendingDeleteIdsRef = useRef<Set<string>>(new Set());
  const flushScheduledRef = useRef(false);
  const flushFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      pendingTasksRef.current = null;
      if (flushFrameRef.current !== null) {
        window.cancelAnimationFrame(flushFrameRef.current);
        flushFrameRef.current = null;
      }
    };
  }, []);

  const applyPendingDeletes = useCallback((next: ShapeBuildTaskSummary[]): ShapeBuildTaskSummary[] => {
    const pendingDeletes = pendingDeleteIdsRef.current;
    if (pendingDeletes.size === 0) return next;
    pendingDeleteIdsRef.current = new Set();
    return next.filter((task) => !pendingDeletes.has(task.taskId));
  }, []);

  const flushTasks = useCallback((next: ShapeBuildTaskSummary[]) => {
    const cleaned = applyPendingDeletes(next);
    if (areTaskListsEqual(cleaned, committedTasksRef.current)) {
      pendingTasksRef.current = null;
      return;
    }
    committedTasksRef.current = cleaned;
    setTasks(cleaned);
    pendingTasksRef.current = null;
    tasksMapRef.current = new Map(cleaned.map((task) => [task.taskId, task]));
  }, [applyPendingDeletes, setTasks]);

  const scheduleFlush = useCallback((next: ShapeBuildTaskSummary[]) => {
    pendingTasksRef.current = next;
    if (flushScheduledRef.current) return;
    flushScheduledRef.current = true;
    flushFrameRef.current = window.requestAnimationFrame(() => {
      flushScheduledRef.current = false;
      flushFrameRef.current = null;
      const pending = pendingTasksRef.current;
      if (pending) {
        flushTasks(pending);
      }
    });
  }, [flushTasks]);

  const resolveTaskSummary = useCallback((task: RawTaskSummary): ShapeBuildTaskSummary => ({
    ...task,
    stage: resolveTaskStage(task),
  }), []);

  const mergeTask = useCallback((task: ShapeBuildTaskSummary) => {
    const baseList = pendingTasksRef.current ?? committedTasksRef.current;
    const currentTask = tasksMapRef.current.get(task.taskId);
    if (!shouldApplyTaskUpdate(currentTask, task)) {
      return baseList;
    }
    const nextMap = new Map(tasksMapRef.current);
    nextMap.set(task.taskId, task);
    tasksMapRef.current = nextMap;
    return sortTasksByIndex(Array.from(nextMap.values()));
  }, []);

  const handleSnapshot = useCallback((next: RawTaskSummary[]) => {
    pendingDeleteIdsRef.current = new Set();
    const resolved = sortTasksByIndex(next.map(resolveTaskSummary));
    tasksMapRef.current = new Map(resolved.map((task) => [task.taskId, task]));
    flushTasks(resolved);
    if (errorRef.current !== null) {
      setError(null);
    }
    if (isLoadingRef.current) {
      setIsLoading(false);
    }
  }, [flushTasks, resolveTaskSummary, setError, setIsLoading]);

  const handleUpdate = useCallback((task: RawTaskSummary) => {
    const resolved = resolveTaskSummary(task);
    const next = mergeTask(resolved);
    scheduleFlush(next);
    if (errorRef.current !== null) {
      setError(null);
    }
    if (isLoadingRef.current) {
      setIsLoading(false);
    }
  }, [mergeTask, resolveTaskSummary, scheduleFlush, setError, setIsLoading]);

  const handleDelete = useCallback((taskId: string) => {
    pendingDeleteIdsRef.current.add(taskId);
    tasksMapRef.current.delete(taskId);
    const current = pendingTasksRef.current ?? committedTasksRef.current;
    scheduleFlush(current);
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
