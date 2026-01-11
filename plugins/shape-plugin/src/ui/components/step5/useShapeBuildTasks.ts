import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { NodeId, NodeType } from '@hierarchidb/common-types';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useAtom } from 'jotai';
import {
  type ShapeBuildTaskSummary,
  tasksAtom,
  tasksErrorAtom,
  tasksLoadingAtom,
} from '../../atoms/shapeBuildProgressAtoms.js';

export interface UseShapeBatchTasksOptions {
  autoRefresh?: boolean | (() => boolean);
  pollIntervalMs?: number;
}

export interface UseShapeBuildTasksState {
  tasks: ShapeBuildTaskSummary[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const SHAPE_NODE_TYPE = 'shape' as NodeType;


export function useShapeBuildTasks(
  nodeId: NodeId | null,
  options: UseShapeBatchTasksOptions = {},
): UseShapeBuildTasksState {
  const { autoRefresh = true, pollIntervalMs = 2000 } = options;
  const bridgeRef = useRef(getWorkerBridge());
  const [tasks, setTasks] = useAtom(tasksAtom);
  const [isLoading, setIsLoading] = useAtom(tasksLoadingAtom);
  const [error, setError] = useAtom(tasksErrorAtom);
  const reportedFailuresRef = useRef<Set<string>>(new Set());
  const pendingTasksRef = useRef<ShapeBuildTaskSummary[] | null>(null);
  const flushTimerRef = useRef<number | null>(null);
  const lastFlushRef = useRef<number>(0);

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
    };
  }, []);

  const flushTasks = useCallback((next: ShapeBuildTaskSummary[]) => {
    setTasks(next);
    lastFlushRef.current = Date.now();
    pendingTasksRef.current = null;
  }, [setTasks]);

  const scheduleFlush = useCallback((next: ShapeBuildTaskSummary[]) => {
    pendingTasksRef.current = next;
    if (flushTimerRef.current) return;
    const now = Date.now();
    const elapsed = now - lastFlushRef.current;
    const delay = Math.max(0, 500 - elapsed);
    flushTimerRef.current = window.setTimeout(() => {
      const pending = pendingTasksRef.current;
      flushTimerRef.current = null;
      if (pending) {
        flushTasks(pending);
      }
    }, delay);
  }, [flushTasks]);

  const refresh = useCallback(async () => {
    if (!nodeId) {
      setTasks([]);
      setError(null);
      console.debug('[ShapeBuildStep] batchTasks:skip', { nodeId });
      return;
    }
    setIsLoading(true);
    try {
      await bridgeRef.current.initialize();
      //console.debug('[ShapeBuildStep] batchTasks:fetch', { nodeId });
      const next = await bridgeRef.current.getBatchTasks(SHAPE_NODE_TYPE, nodeId);
      scheduleFlush(next);
      setError(null);
      //console.debug('[ShapeBuildStep] batchTasks:ok', { nodeId, count: next.length });
    } catch (err) {
      const errObj = err instanceof Error ? err : new Error('Failed to fetch batch tasks');
      setError(errObj);
      console.debug('[ShapeBuildStep] batchTasks:error', {
        nodeId,
        message: errObj.message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [nodeId, scheduleFlush, setError, setIsLoading, setTasks]);

  useEffect(() => {
    if (!nodeId) return;
    if (typeof autoRefresh === 'function' && autoRefresh()) {
      void refresh();
      return;
    }
    if (autoRefresh === true) {
      void refresh();
    }
  }, [autoRefresh, refresh, nodeId]);

  useEffect(() => {
    if (!nodeId) return;
    const shouldAutoRefresh = typeof autoRefresh === 'function'
      ? autoRefresh()
      : autoRefresh;
    if (!shouldAutoRefresh) return;
    const id = window.setInterval(() => {
      const stillAutoRefresh = typeof autoRefresh === 'function'
        ? autoRefresh()
        : autoRefresh;
      if (!stillAutoRefresh) {
        window.clearInterval(id);
        return;
      }
      void refresh();
    }, pollIntervalMs);
    return () => window.clearInterval(id);
  }, [autoRefresh, pollIntervalMs, refresh, nodeId]);

  useEffect(() => {
    const reported = reportedFailuresRef.current;
    tasks.forEach((task) => {
      if (task.status !== 'failed') return;
      if (reported.has(task.taskId)) return;
      reported.add(task.taskId);
      const message = task.message ?? 'Task failed';
      console.warn('[ShapeBuildStep] task failed', {
        taskId: task.taskId,
        stage: task.stage,
        message,
      });
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
