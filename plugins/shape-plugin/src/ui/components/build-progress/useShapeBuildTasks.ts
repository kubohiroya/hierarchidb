import { useCallback, useEffect, useMemo, useRef } from 'react';
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
  refresh: () => Promise<void>;
}

const SHAPE_NODE_TYPE = 'shape' as NodeType;
const isDev = import.meta.env.DEV;
const RUNNING_RESIDUE_LOG_PREFIX = '[ShapeRunningResidue]';
const TASK_SNAPSHOT_RECONCILE_INTERVAL_MS = 5000;

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
  if (!isDev) return;
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
  const reportedFailuresRef = useRef<Set<string>>(new Set());
  const handleSnapshotRef = useRef<(tasks: RawTaskSummary[]) => void>(() => {});
  const handleUpdateRef = useRef<(task: RawTaskSummary) => void>(() => {});
  const handleDeleteRef = useRef<(taskId: string) => void>(() => {});
  const reconcileInFlightRef = useRef(false);
  const subscriptionRef = useRef<(() => void) | null>(null);
  const subscriptionIdRef = useRef(0);

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
      } catch (err) {
        if (cancelled) return;
        const errObj = err instanceof Error ? err : new Error('Failed to subscribe build tasks');
        setError(errObj);
        setIsLoading(false);
      }
    };

    void start();

    const reconcileSnapshot = async () => {
      if (cancelled || subscriptionIdRef.current !== subscriptionId) return;
      if (isLoadingRef.current) return;
      if (!tasksRef.current.some((task) => isTaskInFlight(task))) return;
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
    return;
  }, []);

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
      refresh,
    }),
    [error, isLoading, refresh, tasks],
  );
}
