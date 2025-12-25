import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BatchTaskSummary } from '@hierarchidb/common-api';
import type { NodeType } from '@hierarchidb/common-types';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';

export interface UseShapeBatchTasksOptions {
  autoRefresh?: boolean;
  pollIntervalMs?: number;
}

export interface UseShapeBatchTasksState {
  tasks: BatchTaskSummary[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const SHAPE_NODE_TYPE = 'shape' as NodeType;

export function useShapeBatchTasks(
  sessionId: string | null,
  options: UseShapeBatchTasksOptions = {},
): UseShapeBatchTasksState {
  const { autoRefresh = true, pollIntervalMs = 2000 } = options;
  const bridgeRef = useRef(getWorkerBridge());
  const [tasks, setTasks] = useState<BatchTaskSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

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
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh || !sessionId) return;
    const id = window.setInterval(() => {
      void refresh();
    }, pollIntervalMs);
    return () => window.clearInterval(id);
  }, [autoRefresh, pollIntervalMs, refresh, sessionId]);

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
