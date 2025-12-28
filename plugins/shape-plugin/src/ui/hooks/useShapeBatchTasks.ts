import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BatchTaskSummary } from '@hierarchidb/common-api';
import type { NodeType } from '@hierarchidb/common-types';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';

export interface UseShapeBatchTasksOptions {
  autoRefresh?: boolean | (() => boolean);
  pollIntervalMs?: number;
}

export interface UseShapeBatchTasksState {
  tasks: ShapeBatchTaskSummary[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const SHAPE_NODE_TYPE = 'shape' as NodeType;

export type ShapeBatchTaskSummary = BatchTaskSummary & {
  metadata?: Record<string, unknown>;
  title?: string;
};

export function useShapeBatchTasks(
  sessionId: string | null,
  options: UseShapeBatchTasksOptions = {},
): UseShapeBatchTasksState {
  const { autoRefresh = true, pollIntervalMs = 2000 } = options;
  const bridgeRef = useRef(getWorkerBridge());
  const [tasks, setTasks] = useState<ShapeBatchTaskSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const reportedFailuresRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    reportedFailuresRef.current = new Set();
  }, [sessionId]);

  const refresh = useCallback(async () => {
    if (!sessionId) {
      setTasks([]);
      setError(null);
      console.debug('[ShapeBuildProgressStep] batchTasks:skip', { sessionId });
      return;
    }
    setIsLoading(true);
    try {
      await bridgeRef.current.initialize();
      console.debug('[ShapeBuildProgressStep] batchTasks:fetch', { sessionId });
      const next = await bridgeRef.current.getBatchTasks(SHAPE_NODE_TYPE, sessionId);
      setTasks(next);
      setError(null);
      console.debug('[ShapeBuildProgressStep] batchTasks:ok', { sessionId, count: next.length });
    } catch (err) {
      const errObj = err instanceof Error ? err : new Error('Failed to fetch batch tasks');
      setError(errObj);
      console.debug('[ShapeBuildProgressStep] batchTasks:error', {
        sessionId,
        message: errObj.message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    if (typeof autoRefresh === 'function' && autoRefresh()) {
      void refresh();
      return;
    }
    if (autoRefresh === true) {
      void refresh();
    }
  }, [autoRefresh, refresh, sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const shouldAutoRefresh = typeof autoRefresh === 'function'
      ? autoRefresh()
      : autoRefresh;
    if (!shouldAutoRefresh) return;
    const id = window.setInterval(() => {
      void refresh();
    }, pollIntervalMs);
    return () => window.clearInterval(id);
  }, [autoRefresh, pollIntervalMs, refresh, sessionId]);

  useEffect(() => {
    const reported = reportedFailuresRef.current;
    tasks.forEach((task) => {
      if (task.status !== 'failed') return;
      if (reported.has(task.taskId)) return;
      reported.add(task.taskId);
      const message = task.message ?? 'Task failed';
      console.error('[ShapeBuildProgressStep] task failed', {
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
