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

export function useShapeBuildTasks(
  nodeId: NodeId | null,
  options: UseShapeBuildTasksOptions = {},
): UseShapeBuildTasksState {
  const { autoSubscribe = true } = options;
  const bridgeRef = useRef(getWorkerBridge());
  const [tasks, setTasks] = useAtom(tasksAtom);
  const [isLoading, setIsLoading] = useAtom(tasksLoadingAtom);
  const [error, setError] = useAtom(tasksErrorAtom);
  const reportedFailuresRef = useRef<Set<string>>(new Set());
  const pendingTasksRef = useRef<ShapeBuildTaskSummary[] | null>(null);
  const flushTimerRef = useRef<number | null>(null);
  const lastFlushRef = useRef<number>(0);
  const tasksRef = useRef<ShapeBuildTaskSummary[]>(tasks);
  const subscriptionRef = useRef<(() => void) | null>(null);
  const subscriptionIdRef = useRef(0);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    reportedFailuresRef.current = new Set();
  }, []);

  useEffect(() => {
    return () => {
      if (flushTimerRef.current) {
        window.clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      pendingTasksRef.current = null;
      if (subscriptionRef.current) {
        subscriptionRef.current();
        subscriptionRef.current = null;
      }
    };
  }, []);

  const flushTasks = useCallback((next: ShapeBuildTaskSummary[]) => {
    if (flushTimerRef.current) {
      window.clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    setTasks(next);
    lastFlushRef.current = Date.now();
    pendingTasksRef.current = null;
  }, [setTasks]);

  const scheduleFlush = useCallback((next: ShapeBuildTaskSummary[]) => {
    pendingTasksRef.current = next;
    if (flushTimerRef.current) return;
    const now = Date.now();
    const elapsed = now - lastFlushRef.current;
    const delay = Math.max(0, 10 - elapsed);
    flushTimerRef.current = window.setTimeout(() => {
      const pending = pendingTasksRef.current;
      flushTimerRef.current = null;
      if (pending) {
        flushTasks(pending);
      }
    }, delay);
  }, [flushTasks]);

  const resolveTaskSummary = useCallback((task: RawTaskSummary): ShapeBuildTaskSummary => ({
    ...task,
    stage: resolveTaskStage(task),
  }), []);

  const mergeTask = useCallback((task: ShapeBuildTaskSummary) => {
    const current = pendingTasksRef.current ?? tasksRef.current;
    const idx = current.findIndex((entry) => entry.taskId === task.taskId);
    if (idx >= 0) {
      const next = [...current];
      next[idx] = task;
      return sortTasks(next);
    }
    return sortTasks([...current, task]);
  }, []);

  const handleSnapshot = useCallback((next: RawTaskSummary[]) => {
    const resolved = sortTasks(next.map(resolveTaskSummary));
    flushTasks(resolved);
    setError(null);
    setIsLoading(false);
  }, [flushTasks, resolveTaskSummary, setError, setIsLoading]);

  const handleUpdate = useCallback((task: RawTaskSummary) => {
    const resolved = resolveTaskSummary(task);
    const next = mergeTask(resolved);
    scheduleFlush(next);
    setError(null);
    setIsLoading(false);
  }, [mergeTask, resolveTaskSummary, scheduleFlush, setError, setIsLoading]);

  const handleDelete = useCallback((taskId: string) => {
    const current = pendingTasksRef.current ?? tasksRef.current;
    const next = current.filter((task) => task.taskId !== taskId);
    scheduleFlush(next);
    setError(null);
    setIsLoading(false);
  }, [scheduleFlush, setError, setIsLoading]);

  useEffect(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current();
      subscriptionRef.current = null;
    }
    pendingTasksRef.current = null;
    if (!nodeId || !autoSubscribe) {
      setTasks([]);
      setError(null);
      setIsLoading(false);
      return;
    }
    setTasks([]);
    setError(null);
    setIsLoading(true);
    const subscriptionId = subscriptionIdRef.current + 1;
    subscriptionIdRef.current = subscriptionId;
    let cancelled = false;

    const handleEvent = (event: BatchTaskUpdateEvent<RawTaskSummary>) => {
      if (cancelled || subscriptionIdRef.current !== subscriptionId) return;
      if (event.type === 'snapshot') {
        handleSnapshot(event.tasks);
        return;
      }
      if (event.type === 'update') {
        handleUpdate(event.task);
        return;
      }
      if (event.type === 'delete') {
        handleDelete(event.taskId);
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
    handleDelete,
    handleSnapshot,
    handleUpdate,
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
