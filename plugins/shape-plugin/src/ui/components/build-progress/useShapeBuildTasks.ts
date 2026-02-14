import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { getWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useAtom } from 'jotai';
import {
  type ShapeBuildTaskSummary,
  tasksAtom,
  tasksErrorAtom,
  tasksLoadingAtom,
} from '../../atoms/shapeBuildProgressAtoms.js';
import type { BuildTaskUpdateEvent } from '@hierarchidb/batch-api';
import { parseGeometrySimplifyError } from './geometrySimplifyError.ts';
import { useShapeBuildTaskSync, type RawTaskSummary } from './useShapeBuildTaskSync.ts';

export interface UseShapeBuildTasksOptions {
  autoSubscribe?: boolean;
  reportFailures?: boolean;
}

export interface UseShapeBuildTasksState {
  tasks: ShapeBuildTaskSummary[];
  isLoading: boolean;
  error: Error | null;
  isTaskStreamReady: boolean;
  refresh: () => Promise<void>;
}

const SHAPE_NODE_TYPE = 'shape' as NodeType;
const isDev = import.meta.env.DEV;
const RUNNING_RESIDUE_LOG_PREFIX = '[ShapeRunningResidue]';
const TASK_SNAPSHOT_RECONCILE_INTERVAL_MS = 1000;
const EMPTY_TASK_RECONCILE_WINDOW_MS = 60_000;

type TaskSyncDebugConfig = Partial<Record<'runningResidue' | 'all', boolean>>;

const readTaskSyncDebugConfig = (): TaskSyncDebugConfig | null => {
  const scope = globalThis as typeof globalThis & {
    __HDB_SHAPE_BUILD_TASK_SYNC_DEBUG__?: unknown;
  };
  const raw = scope.__HDB_SHAPE_BUILD_TASK_SYNC_DEBUG__;
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  return raw as TaskSyncDebugConfig;
};

const isRunningResidueDebugEnabled = (): boolean => {
  if (!isDev) return false;
  const config = readTaskSyncDebugConfig();
  if (!config) return false;
  return config.all === true || config.runningResidue === true;
};

const isTaskInFlight = (task: ShapeBuildTaskSummary): boolean => (
  task.status === 'running' || task.status === 'queued'
);

const logRunningResidueDrop = (payload: {
  nodeId: string | null;
  source: string;
  eventType: string;
  reason?: string;
  taskId?: string | null;
}): void => {
  if (!isRunningResidueDebugEnabled()) return;
  if (payload.reason === 'subscription_cancelled') {
    // Expected during unmount/reload/reset cleanup.
    return;
  }
  console.log(
    `${RUNNING_RESIDUE_LOG_PREFIX} STALE_DROP`
      + ` nodeId=${payload.nodeId ?? '-'}`
      + ` source=${payload.source}`
      + ` eventType=${payload.eventType}`
      + ` taskId=${payload.taskId ?? '-'}`
      + ` reason=${payload.reason ?? '-'}`
      + ` timestamp=${Date.now()}`,
    payload,
  );
};

export function useShapeBuildTasks(
  nodeId: NodeId | null,
  options: UseShapeBuildTasksOptions = {},
): UseShapeBuildTasksState {
  const { autoSubscribe = true, reportFailures = true } = options;
  const bridgeRef = useRef(getWorkerBridge());
  const [tasks, setTasks] = useAtom(tasksAtom);
  const [isLoading, setIsLoading] = useAtom(tasksLoadingAtom);
  const [error, setError] = useAtom(tasksErrorAtom);
  const [isTaskStreamReady, setIsTaskStreamReady] = useState(false);
  const reportedFailuresRef = useRef<Set<string>>(new Set());
  const handleSnapshotRef = useRef<(tasks: RawTaskSummary[]) => void>(() => {});
  const handleUpdateRef = useRef<(task: RawTaskSummary) => void>(() => {});
  const handleDeleteRef = useRef<(taskId: string) => void>(() => {});
  const reconcileInFlightRef = useRef(false);
  const subscriptionRef = useRef<(() => void) | null>(null);
  const subscriptionIdRef = useRef(0);

  const markTaskStreamSynchronized = useCallback(() => {
    setIsTaskStreamReady((current) => (current ? current : true));
  }, []);

  const {
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
  } = useShapeBuildTaskSync({
    sessionNodeId: nodeId ? String(nodeId) : null,
    setTasks,
    setIsLoading,
    setError,
    markTaskStreamSynchronized,
  });

  useEffect(() => {
    reportedFailuresRef.current = new Set();
  }, []);

  useEffect(() => {
    syncTasksRef(tasks);
  }, [syncTasksRef, tasks]);

  useEffect(() => {
    syncLoadingRef(isLoading);
  }, [isLoading, syncLoadingRef]);

  useEffect(() => {
    syncErrorRef(error);
  }, [error, syncErrorRef]);

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
    setIsTaskStreamReady(false);
    resetPending();
    const hadTasks = tasksRef.current.length > 0;
    const hadError = errorRef.current !== null;
    const wasLoading = isLoadingRef.current;
    if (!nodeId || !autoSubscribe) {
      syncTasksRef([]);
      if (hadTasks) {
        setTasks([]);
      }
      if (hadError) {
        setError(null);
      }
      if (wasLoading) {
        setIsLoading(false);
      }
      return;
    }
    syncTasksRef([]);
    if (hadTasks) {
      setTasks([]);
    }
    if (hadError) {
      setError(null);
    }
    if (!wasLoading) {
      setIsLoading(true);
    }
    const subscriptionId = subscriptionIdRef.current + 1;
    subscriptionIdRef.current = subscriptionId;
    let cancelled = false;

    const handleEvent = (event: BuildTaskUpdateEvent<RawTaskSummary>) => {
      if (String(event.nodeId) !== String(nodeId)) {
        logRunningResidueDrop({
          nodeId: nodeId ? String(nodeId) : null,
          source: 'subscription',
          eventType: event.type,
          taskId: event.type === 'update' ? event.task.taskId : event.type === 'delete' ? event.taskId : null,
          reason: 'node_id_mismatch',
        });
        return;
      }
      if (cancelled || subscriptionIdRef.current !== subscriptionId) {
        logRunningResidueDrop({
          nodeId: nodeId ? String(nodeId) : null,
          source: 'subscription',
          eventType: event.type,
          taskId: event.type === 'update' ? event.task.taskId : event.type === 'delete' ? event.taskId : null,
          reason: cancelled ? 'subscription_cancelled' : 'subscription_id_mismatch',
        });
        return;
      }
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

    const subscribedAt = Date.now();

    const reconcileSnapshot = async () => {
      if (cancelled || subscriptionIdRef.current !== subscriptionId) return;
      const hasInFlightTasks = tasksRef.current.some((task) => isTaskInFlight(task));
      const hasNoTasks = tasksRef.current.length === 0;
      const withinEmptyTaskWindow = Date.now() - subscribedAt <= EMPTY_TASK_RECONCILE_WINDOW_MS;
      if (!hasInFlightTasks && !(hasNoTasks && withinEmptyTaskWindow)) return;
      if (reconcileInFlightRef.current) return;
      reconcileInFlightRef.current = true;
      try {
        const latestTasks = await bridgeRef.current.getBuildTasks(SHAPE_NODE_TYPE, nodeId);
        if (cancelled || subscriptionIdRef.current !== subscriptionId) {
          return;
        }
        handleSnapshotRef.current(latestTasks as RawTaskSummary[]);
      } catch (err) {
        if (!cancelled && isDev) {
          console.debug('[ShapeBuildStep] task snapshot reconcile skipped', err);
        }
      } finally {
        reconcileInFlightRef.current = false;
      }
    };

    const start = async () => {
      try {
        await bridgeRef.current.initialize();
        const unsubscribe = await bridgeRef.current.subscribeBuildTasks(
          SHAPE_NODE_TYPE,
          nodeId,
          handleEvent,
        );
        if (cancelled) {
          unsubscribe();
          return;
        }
        subscriptionRef.current = unsubscribe;
        void reconcileSnapshot();
      } catch (err) {
        if (cancelled) return;
        const errObj = err instanceof Error ? err : new Error('Failed to subscribe build tasks');
        setError(errObj);
        setIsLoading(false);
      }
    };

    void start();
    const reconcileTimer = window.setInterval(() => {
      void reconcileSnapshot();
    }, TASK_SNAPSHOT_RECONCILE_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(reconcileTimer);
      if (subscriptionRef.current) {
        subscriptionRef.current();
        subscriptionRef.current = null;
      }
      reconcileInFlightRef.current = false;
    };
  }, [
    autoSubscribe,
    nodeId,
    setError,
    setIsLoading,
    setTasks,
    syncTasksRef,
  ]);

  const refresh = useCallback(async () => {
    if (!nodeId) return;
    const wasLoading = isLoadingRef.current;
    if (!wasLoading) {
      setIsLoading(true);
    }
    try {
      const latestTasks = await bridgeRef.current.getBuildTasks(SHAPE_NODE_TYPE, nodeId);
      handleSnapshotRef.current(latestTasks as RawTaskSummary[]);
    } catch (err) {
      const errObj = err instanceof Error ? err : new Error('Failed to refresh build tasks');
      setError(errObj);
    } finally {
      if (!wasLoading) {
        setIsLoading(false);
      }
    }
  }, [nodeId, setError, setIsLoading]);

  useEffect(() => {
    if (!reportFailures) return;
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
  }, [reportFailures, tasks]);

  return useMemo(
    () => ({
      tasks,
      isLoading,
      error,
      isTaskStreamReady,
      refresh,
    }),
    [error, isLoading, isTaskStreamReady, refresh, tasks],
  );
}
