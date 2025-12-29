import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { BatchTaskSummary } from '@hierarchidb/common-api';
import type { NodeType } from '@hierarchidb/common-types';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useAtom } from 'jotai';
import {
  shapeBuildTasksAtom,
  shapeBuildTasksErrorAtom,
  shapeBuildTasksLoadingAtom,
} from '../state/shapeBuildProgressAtoms.js';

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
  nodeId: string | null,
  options: UseShapeBatchTasksOptions = {},
): UseShapeBatchTasksState {
  const { autoRefresh = true, pollIntervalMs = 2000 } = options;
  const bridgeRef = useRef(getWorkerBridge());
  const [tasks, setTasks] = useAtom(shapeBuildTasksAtom);
  const [isLoading, setIsLoading] = useAtom(shapeBuildTasksLoadingAtom);
  const [error, setError] = useAtom(shapeBuildTasksErrorAtom);
  const reportedFailuresRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    reportedFailuresRef.current = new Set();
  }, [nodeId]);

  const refresh = useCallback(async () => {
    if (!nodeId) {
      setTasks([]);
      setError(null);
      console.debug('[ShapeBuildProgressStep] batchTasks:skip', { nodeId });
      return;
    }
    setIsLoading(true);
    try {
      await bridgeRef.current.initialize();
      console.debug('[ShapeBuildProgressStep] batchTasks:fetch', { nodeId });
      const next = await bridgeRef.current.getBatchTasks(SHAPE_NODE_TYPE, nodeId);
      setTasks(next);
      setError(null);
      console.debug('[ShapeBuildProgressStep] batchTasks:ok', { nodeId, count: next.length });
    } catch (err) {
      const errObj = err instanceof Error ? err : new Error('Failed to fetch batch tasks');
      setError(errObj);
      console.debug('[ShapeBuildProgressStep] batchTasks:error', {
        nodeId,
        message: errObj.message,
      });
    } finally {
      setIsLoading(false);
    }
  }, [nodeId]);

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
      console.warn('[ShapeBuildProgressStep] task failed', {
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
