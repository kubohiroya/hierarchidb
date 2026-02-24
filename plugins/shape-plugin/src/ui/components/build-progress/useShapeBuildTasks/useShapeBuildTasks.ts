import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { useAtom } from 'jotai';
import {
  type ShapeBuildTaskSummary,
  tasksAtom,
  tasksErrorAtom,
  tasksLoadingAtom,
} from '~/ui/atoms/shapeBuildProgressAtoms';
import type { BuildTaskSummary, BuildTaskUpdateEvent } from '@hierarchidb/build-api';
import { parseGeometrySimplifyError } from '~/ui/components/build-progress/geometrySimplifyError';
import { useShapeBuildTaskSync } from '~/ui/components/build-progress/useShapeBuildTaskSync/useShapeBuildTaskSync';
import type { RawTaskSummary } from '~/ui/components/build-progress/useShapeBuildTaskSync/useShapeBuildTaskSync.types';
import { SHAPE_NODE_TYPE, logRunningResidueDrop } from '~/ui/components/build-progress/shapeBuildTaskSyncDebug';
import { isTerminalTask } from '~/ui/components/build-progress/useShapeBuildTaskSync/useShapeBuildTaskSync.comparison.utils.js';

type StageCountByStage = Record<string, number>;

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
  snapshotTaskCountByStage: StageCountByStage;
  terminalTaskCountByStage: StageCountByStage;
}

const isTerminalForCompletion = (task: ShapeBuildTaskSummary): boolean => (
  isTerminalTask(task)
);

type ShapeBuildTaskUpdateEvent = BuildTaskUpdateEvent<BuildTaskSummary>;

const toRawTaskSummary = (task: BuildTaskSummary): RawTaskSummary => {
  return {
    ...task,
  };
};

export function useShapeBuildTasks(
  nodeId: NodeId | null,
  options: UseShapeBuildTasksOptions = {},
): UseShapeBuildTasksState {
  const { autoSubscribe = true, reportFailures = true } = options;
  const bridgeRef = useRef(getBuildWorkerBridge());
  const [tasks, setTasks] = useAtom(tasksAtom);
  const [isLoading, setIsLoading] = useAtom(tasksLoadingAtom);
  const [error, setError] = useAtom(tasksErrorAtom);
  const [isTaskStreamReady, setIsTaskStreamReady] = useState(false);
  const snapshotTaskCountByStage = useMemo<StageCountByStage>(() => {
    const next: StageCountByStage = {};
    for (const task of tasks) {
      const stage = task.stage;
      next[stage] = (next[stage] ?? 0) + 1;
    }
    return next;
  }, [tasks]);
  const terminalTaskCountByStage = useMemo<StageCountByStage>(() => {
    const next: StageCountByStage = {};
    for (const task of tasks) {
      if (!isTerminalForCompletion(task)) {
        continue;
      }
      const stage = task.stage;
      next[stage] = (next[stage] ?? 0) + 1;
    }
    return next;
  }, [tasks]);
  const reportedFailuresRef = useRef<Set<string>>(new Set());
  const handleSnapshotRef = useRef<(tasks: ShapeBuildTaskSummary[]) => void>(() => {});
  const handleUpdateRef = useRef<(task: RawTaskSummary) => void>(() => {});
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
    syncLoadingRef(isLoading);
  }, [isLoading, syncLoadingRef]);

  useEffect(() => {
    syncErrorRef(error);
  }, [error, syncErrorRef]);

  useEffect(() => {
    handleSnapshotRef.current = handleSnapshot;
    handleUpdateRef.current = handleUpdate;
  }, [handleSnapshot, handleUpdate]);

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

    const handleEvent = (event: ShapeBuildTaskUpdateEvent) => {
      if (String(event.nodeId) !== String(nodeId)) {
        logRunningResidueDrop({
          nodeId: nodeId ? String(nodeId) : null,
          source: 'subscription',
          eventType: event.type,
          taskId: event.type === 'update' ? event.task.taskId : null,
          reason: 'node_id_mismatch',
        });
        return;
      }
      if (cancelled || subscriptionIdRef.current !== subscriptionId) {
        logRunningResidueDrop({
          nodeId: nodeId ? String(nodeId) : null,
          source: 'subscription',
          eventType: event.type,
          taskId: event.type === 'update' ? event.task.taskId : null,
          reason: cancelled ? 'subscription_cancelled' : 'subscription_id_mismatch',
        });
        return;
      }
      try {
        if (event.type === 'snapshot') {
          console.log('[ShapeBuildTaskSync] snapshot event received', JSON.stringify({
            nodeId,
            taskCount: event.tasks.length,
          }));
          handleSnapshotRef.current(event.tasks.map((task) => toRawTaskSummary(task)));
          return;
        }
        if (event.type === 'update') {
          handleUpdateRef.current(toRawTaskSummary(event.task));
          return;
        }
      } catch (error) {
        const errObj = error instanceof Error ? error : new Error('Shape build task sync handler failed');
        setError(errObj);
        throw errObj;
      }
      logRunningResidueDrop({
        nodeId: nodeId ? String(nodeId) : null,
        source: 'subscription',
        eventType: event.type,
        taskId: null,
        reason: 'unhandled_task_update_event',
      });
      return;
    };

    const start = async () => {
      try {
        console.log('[ShapeBuildTaskSync] subscribeBuildTasks start', JSON.stringify({
          nodeId,
          autoSubscribe,
          nodeType: SHAPE_NODE_TYPE,
        }));
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
        console.log('[ShapeBuildTaskSync] subscribeBuildTasks started', JSON.stringify({
          nodeId,
        }));
      } catch (err) {
        if (cancelled) return;
        const errObj = err instanceof Error ? err : new Error('Failed to subscribe build tasks');
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
        console.log('[ShapeBuildTaskSync] subscribeBuildTasks cleanup', JSON.stringify({
          nodeId,
        }));
      }
    };
  }, [
    autoSubscribe,
    nodeId,
    setError,
    setIsLoading,
    setTasks,
    syncTasksRef,
    resetPending,
    tasksRef,
    errorRef,
    isLoadingRef,
  ]);

  const refresh = useCallback(async () => {
    if (!nodeId) return;
    if (!isLoadingRef.current) {
      setIsLoading(true);
    }
    isLoadingRef.current = true;
    try {
      const latestTasks = await bridgeRef.current.getBuildTasks(SHAPE_NODE_TYPE, nodeId);
      console.log('[ShapeBuildTaskSync] snapshot refresh received', JSON.stringify({
        nodeId,
        taskCount: latestTasks.length,
      }));
      handleSnapshotRef.current(latestTasks.map((task) => toRawTaskSummary(task)));
    } catch (err) {
      const errObj = err instanceof Error ? err : new Error('Failed to refresh build tasks');
      setError(errObj);
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
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
      snapshotTaskCountByStage,
      terminalTaskCountByStage,
    }),
    [
      error,
      isLoading,
      isTaskStreamReady,
      refresh,
      snapshotTaskCountByStage,
      terminalTaskCountByStage,
      tasks,
    ],
  );
}
