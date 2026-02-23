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
import type { BuildTaskUpdateEvent } from '../../../../../../../packages/build-api';
import { parseGeometrySimplifyError } from '~/ui/components/build-progress/geometrySimplifyError';
import { useShapeBuildTaskSync } from '~/ui/components/build-progress/useShapeBuildTaskSync/useShapeBuildTaskSync';
import type { RawTaskSummary } from '~/ui/components/build-progress/useShapeBuildTaskSync/useShapeBuildTaskSync.types';
import { SHAPE_NODE_TYPE, logRunningResidueDrop } from '~/ui/components/build-progress/shapeBuildTaskSyncDebug';
import { normalizeStageKey } from '~/ui/components/build-progress/internal/useShapeBuildStepHelpers/stage.js';
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
  const [snapshotTaskCountByStage, setSnapshotTaskCountByStage] = useState<StageCountByStage>({});
  const [terminalTaskCountByStage, setTerminalTaskCountByStage] = useState<StageCountByStage>({});
  const [subscriptionEpoch, setSubscriptionEpoch] = useState(0);
  const snapshotTaskCountByStageRef = useRef<Map<string, number>>(new Map());
  const terminalTaskCountByTaskIdRef = useRef<Map<string, string>>(new Map());
  const reportedFailuresRef = useRef<Set<string>>(new Set());
  const handleSnapshotRef = useRef<(tasks: unknown) => void>(() => {});
  const handleUpdateRef = useRef<(task: RawTaskSummary) => void>(() => {});
  const subscriptionRef = useRef<(() => void) | null>(null);
  const subscriptionIdRef = useRef(0);

  const markTaskStreamSynchronized = useCallback(() => {
    setIsTaskStreamReady((current) => (current ? current : true));
  }, []);

  const resetSnapshotTaskCounts = useCallback(() => {
    snapshotTaskCountByStageRef.current = new Map();
    terminalTaskCountByTaskIdRef.current = new Map();
    setSnapshotTaskCountByStage({});
    setTerminalTaskCountByStage({});
  }, []);

  const onTaskSnapshot = useCallback((nextTasks: ShapeBuildTaskSummary[]) => {
    const incomingSnapshotCounts = new Map<string, number>();
    const nextSnapshotCounts = new Map<string, number>(snapshotTaskCountByStageRef.current);
    const nextTerminalTaskIds = new Map<string, string>(terminalTaskCountByTaskIdRef.current);
    const incomingStages = new Set<string>();
    const nextTerminalCounts = new Map<string, number>();

    for (const task of nextTasks) {
      const stage = normalizeStageKey(task);
      incomingStages.add(stage);
      incomingSnapshotCounts.set(stage, (incomingSnapshotCounts.get(stage) ?? 0) + 1);

      if (!isTerminalForCompletion(task)) {
        continue;
      }
      nextTerminalTaskIds.set(task.taskId, stage);
    }

    for (const terminalTaskStage of nextTerminalTaskIds.values()) {
      nextTerminalCounts.set(terminalTaskStage, (nextTerminalCounts.get(terminalTaskStage) ?? 0) + 1);
    }

    for (const [taskId, taskStage] of terminalTaskCountByTaskIdRef.current.entries()) {
      if (!incomingStages.has(taskStage)) {
        continue;
      }
      nextTerminalTaskIds.delete(taskId);
    }

    for (const [terminalTaskStage] of nextSnapshotCounts.entries()) {
      if (!nextTerminalCounts.has(terminalTaskStage)) {
        nextTerminalCounts.set(terminalTaskStage, 0);
      }
    }

    for (const [stage, count] of incomingSnapshotCounts.entries()) {
      nextSnapshotCounts.set(stage, count);
    }

    snapshotTaskCountByStageRef.current = nextSnapshotCounts;
    terminalTaskCountByTaskIdRef.current = nextTerminalTaskIds;
    setSnapshotTaskCountByStage(Object.fromEntries(nextSnapshotCounts.entries()));
    setTerminalTaskCountByStage(Object.fromEntries(nextTerminalCounts.entries()));
  }, []);

  const onTaskTerminalProgressUpdate = useCallback((task: ShapeBuildTaskSummary) => {
    const stage = normalizeStageKey(task);
    const previousStage = terminalTaskCountByTaskIdRef.current.get(task.taskId);
    if (previousStage === stage) {
      return;
    }

    if (!isTerminalForCompletion(task)) {
      if (previousStage !== undefined) {
        terminalTaskCountByTaskIdRef.current.delete(task.taskId);
      }
    } else {
      terminalTaskCountByTaskIdRef.current.set(task.taskId, stage);
    }
    const nextTerminalCounts = new Map<string, number>();
    for (const terminalTaskStage of terminalTaskCountByTaskIdRef.current.values()) {
      nextTerminalCounts.set(terminalTaskStage, (nextTerminalCounts.get(terminalTaskStage) ?? 0) + 1);
    }
    setTerminalTaskCountByStage(Object.fromEntries(nextTerminalCounts.entries()));
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
    onTaskSnapshot,
    onTaskTerminalProgressUpdate,
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
    resetSnapshotTaskCounts();
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

    const handleEvent = (event: BuildTaskUpdateEvent) => {
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
      if (event.type === 'snapshot') {
        handleSnapshotRef.current(event.tasks as RawTaskSummary[]);
        return;
      }
      if (event.type === 'update') {
        handleUpdateRef.current(event.task as RawTaskSummary);
        return;
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
    subscriptionEpoch,
    setError,
    setIsLoading,
    setTasks,
    syncTasksRef,
    resetPending,
    resetSnapshotTaskCounts,
    tasksRef,
    errorRef,
    isLoadingRef,
  ]);

  const refresh = useCallback(async () => {
    if (!nodeId) return;
    setSubscriptionEpoch((current) => current + 1);
    if (subscriptionRef.current) {
      subscriptionRef.current();
      subscriptionRef.current = null;
    }
    const wasLoading = isLoadingRef.current;
    if (!wasLoading) {
      setIsLoading(true);
    }
    try {
      const latestTasks = await bridgeRef.current.getBuildTasks(SHAPE_NODE_TYPE, nodeId);
      handleSnapshotRef.current(latestTasks);
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
