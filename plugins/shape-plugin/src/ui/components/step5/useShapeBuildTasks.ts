import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { NodeId, NodeType, TaskStage } from '@hierarchidb/common-types';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useAtom } from 'jotai';
import {
  type ShapeBuildTaskSummary,
  tasksAtom,
  tasksErrorAtom,
  tasksLoadingAtom,
} from '../../atoms/shapeBuildProgressAtoms.js';
import type { BatchTaskSummary, BatchTaskUpdateEvent } from '@hierarchidb/common-api';
import { parseGeometrySimplifyError } from './geometrySimplifyError.ts';

export interface UseShapeBuildTasksOptions {
  autoSubscribe?: boolean;
}

export interface UseShapeBuildTasksState {
  tasks: ShapeBuildTaskSummary[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const SHAPE_NODE_TYPE = 'shape' as NodeType;

type RawTaskSummary = BatchTaskSummary & {
  taskType?: string;
  type?: string;
  stage?: string;
  title?: string;
  metadata?: Record<string, unknown>;
  error?: string;
  errorMessage?: string;
  index?: number;
  sequence?: number;
  updatedAt?: number;
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

const resolveTaskIndex = (task: ShapeBuildTaskSummary): number => {
  if (typeof task.index === 'number' && Number.isFinite(task.index)) {
    return task.index;
  }
  return Number.MAX_SAFE_INTEGER;
};

const sortTasks = (items: ShapeBuildTaskSummary[]): ShapeBuildTaskSummary[] => (
  [...items].sort((a, b) => resolveTaskIndex(a) - resolveTaskIndex(b))
);

const isSameTaskList = (next: ShapeBuildTaskSummary[], current: ShapeBuildTaskSummary[]): boolean => {
  if (next.length !== current.length) return false;
  for (let i = 0; i < next.length; i += 1) {
    const nextTask = next[i];
    const currentTask = current[i];
    if (!nextTask || !currentTask) return false;
    if (nextTask.taskId !== currentTask.taskId) return false;
    const nextSeq = typeof nextTask.sequence === 'number' ? nextTask.sequence : null;
    const currentSeq = typeof currentTask.sequence === 'number' ? currentTask.sequence : null;
    if (nextSeq !== null || currentSeq !== null) {
      if (nextSeq !== currentSeq) return false;
      continue;
    }
    if (nextTask.status !== currentTask.status) return false;
    if (nextTask.progress !== currentTask.progress) return false;
  }
  return true;
};

export function useShapeBuildTasks(
  nodeId: NodeId | null,
  options: UseShapeBuildTasksOptions = {},
): UseShapeBuildTasksState {
  const { autoSubscribe = true } = options;
  const bridgeRef = useRef(getWorkerBridge());
  const [tasks, setTasks] = useAtom(tasksAtom);
  const [isLoading, setIsLoading] = useAtom(tasksLoadingAtom);
  const [error, setError] = useAtom(tasksErrorAtom);
  const isLoadingRef = useRef(isLoading);
  const errorRef = useRef<Error | null>(error);
  const reportedFailuresRef = useRef<Set<string>>(new Set());
  const pendingTasksRef = useRef<ShapeBuildTaskSummary[] | null>(null);
  const flushScheduledRef = useRef(false);
  const flushFrameRef = useRef<number | null>(null);
  const tasksMapRef = useRef<Map<string, ShapeBuildTaskSummary>>(new Map());
  const pendingDeleteIdsRef = useRef<Set<string>>(new Set());
  const tasksRef = useRef<ShapeBuildTaskSummary[]>(tasks);
  const handleSnapshotRef = useRef<(tasks: RawTaskSummary[]) => void>(() => {});
  const handleUpdateRef = useRef<(task: RawTaskSummary) => void>(() => {});
  const handleDeleteRef = useRef<(taskId: string) => void>(() => {});
  const subscriptionRef = useRef<(() => void) | null>(null);
  const subscriptionIdRef = useRef(0);

  useEffect(() => {
    tasksRef.current = tasks;
    tasksMapRef.current = new Map(tasks.map((task) => [task.taskId, task]));
  }, [tasks]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    errorRef.current = error;
  }, [error]);

  useEffect(() => {
    reportedFailuresRef.current = new Set();
  }, []);

  useEffect(() => {
    return () => {
      pendingTasksRef.current = null;
      if (flushFrameRef.current !== null) {
        window.cancelAnimationFrame(flushFrameRef.current);
        flushFrameRef.current = null;
      }
      if (subscriptionRef.current) {
        subscriptionRef.current();
        subscriptionRef.current = null;
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
    if (isSameTaskList(cleaned, tasksRef.current)) {
      pendingTasksRef.current = null;
      return;
    }
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
    const baseList = pendingTasksRef.current ?? tasksRef.current;
    const currentTask = tasksMapRef.current.get(task.taskId);
    if (currentTask) {
      const currentSequence = typeof currentTask.sequence === 'number' ? currentTask.sequence : null;
      const nextSequence = typeof task.sequence === 'number' ? task.sequence : null;
      if (currentSequence !== null && nextSequence !== null && nextSequence <= currentSequence) {
        console.debug('[ShapeBuildStep] task update ignored', {
          taskId: task.taskId,
          stage: task.stage,
          currentSequence,
          nextSequence,
        });
        return baseList;
      }
    }
    const nextMap = new Map(tasksMapRef.current);
    nextMap.set(task.taskId, task);
    tasksMapRef.current = nextMap;
    return sortTasks(Array.from(nextMap.values()));
  }, []);

  const handleSnapshot = useCallback((next: RawTaskSummary[]) => {
    pendingDeleteIdsRef.current = new Set();
    const resolved = sortTasks(next.map(resolveTaskSummary));
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
    const current = pendingTasksRef.current ?? tasksRef.current;
    scheduleFlush(current);
    if (errorRef.current !== null) {
      setError(null);
    }
    if (isLoadingRef.current) {
      setIsLoading(false);
    }
  }, [scheduleFlush, setError, setIsLoading]);

  useEffect(() => {
    handleSnapshotRef.current = handleSnapshot;
    handleUpdateRef.current = handleUpdate;
    handleDeleteRef.current = handleDelete;
  }, [handleSnapshot, handleUpdate, handleDelete]);

  useEffect(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current();
      subscriptionRef.current = null;
    }
    pendingTasksRef.current = null;
    if (!nodeId || !autoSubscribe) {
      if (tasksRef.current.length > 0) {
        setTasks([]);
      }
      if (errorRef.current !== null) {
        setError(null);
      }
      if (isLoadingRef.current) {
        setIsLoading(false);
      }
      return;
    }
    if (tasksRef.current.length > 0) {
      setTasks([]);
    }
    if (errorRef.current !== null) {
      setError(null);
    }
    if (!isLoadingRef.current) {
      setIsLoading(true);
    }
    const subscriptionId = subscriptionIdRef.current + 1;
    subscriptionIdRef.current = subscriptionId;
    let cancelled = false;

    const handleEvent = (event: BatchTaskUpdateEvent<RawTaskSummary>) => {
      if (cancelled || subscriptionIdRef.current !== subscriptionId) return;
      if (event.type === 'snapshot') {
        handleSnapshotRef.current(event.tasks);
        return;
      }
      if (event.type === 'update') {
        handleUpdateRef.current(event.task);
        return;
      }
      if (event.type === 'delete') {
        handleDeleteRef.current(event.taskId);
      }
    };

    const start = async () => {
      try {
        await bridgeRef.current.initialize();
        const unsubscribe = await bridgeRef.current.subscribeBatchTasks(
          SHAPE_NODE_TYPE,
          nodeId,
          handleEvent,
        );
        if (cancelled) {
          unsubscribe();
          return;
        }
        subscriptionRef.current = unsubscribe;
      } catch (err) {
        if (cancelled) return;
        const errObj = err instanceof Error ? err : new Error('Failed to subscribe batch tasks');
        setError(errObj);
        setIsLoading(false);
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (subscriptionRef.current) {
        subscriptionRef.current();
        subscriptionRef.current = null;
      }
    };
  }, [
    autoSubscribe,
    nodeId,
    setError,
    setIsLoading,
    setTasks,
  ]);

  const refresh = useCallback(async () => {
    return;
  }, []);

  useEffect(() => {
    const reported = reportedFailuresRef.current;
    tasks.forEach((task) => {
      if (task.status !== 'failed') return;
      if (reported.has(task.taskId)) return;
      reported.add(task.taskId);
      const message = task.message ?? 'Task failed';
      const geometryDetails = parseGeometrySimplifyError(message);
      if (geometryDetails) {
        console.warn('[ShapeBuildStep] task failed:geometrySimplify', {
          taskId: task.taskId,
          stage: task.stage,
          message,
          details: geometryDetails,
        });
        return;
      }
      console.warn('[ShapeBuildStep] task failed', { taskId: task.taskId, stage: task.stage, message });
    });
  }, [tasks]);

  return useMemo(
    () => ({
      tasks,
      isLoading,
      error,
      refresh,
    }),
    [error, isLoading, refresh, tasks],
  );
}
