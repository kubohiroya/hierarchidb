import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import { getBuildWorkerBridge } from '@hierarchidb/ui-worker-client';
import { resolveTaskMetadataMessage } from '~/common/utils/taskMessages';
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

export type StageId = string;
type StageCountByStage = Record<StageId, number>;
export type StageOrder = readonly StageId[];

export type BuildStageState = {
  stage: StageId;
  stageTask: ShapeBuildTaskSummary[];
  stageTaskCompletedById: Map<string, ShapeBuildTaskSummary>;
  isCompleted: boolean;
  hasSnapshot: boolean;
};

export type BuildStageStateById = Map<StageId, BuildStageState>;

export interface UseShapeBuildTaskSnapshotProgressOptions {
  autoSubscribe?: boolean;
  reportFailures?: boolean;
  onTaskSnapshot?: (tasks: ShapeBuildTaskSummary[]) => void;
  stageOrder?: StageOrder;
}

export interface UseShapeBuildTaskSnapshotProgressState {
  tasks: ShapeBuildTaskSummary[];
  isLoading: boolean;
  error: Error | null;
  isTaskSnapshotProgressConnected: boolean;
  hasAnyTaskSnapshot: boolean;
  hasTaskSnapshotByStage: Record<StageId, boolean>;
  stageOrder: StageId[];
  stageBuildStateById: BuildStageStateById;
  /**
   * @deprecated UI runtime flow must rely on subscribed snapshot/progress events.
   * Keep only for focused tests and emergency diagnostics.
   */
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

const createBuildStageState = (stage: StageId, hasSnapshot: boolean): BuildStageState => ({
  stage,
  stageTask: [],
  stageTaskCompletedById: new Map<string, ShapeBuildTaskSummary>(),
  isCompleted: false,
  hasSnapshot,
});

const markSnapshotReceivedByStage = (
  snapshotTasks: ShapeBuildTaskSummary[],
  previous: Record<StageId, boolean>,
): Record<StageId, boolean> => {
  if (snapshotTasks.length === 0) {
    return previous;
  }
  const next: Record<StageId, boolean> = { ...previous };
  let updated = false;
  for (const task of snapshotTasks) {
    if (next[task.stage]) {
      continue;
    }
    next[task.stage] = true;
    updated = true;
  }
  return updated ? next : previous;
};

const normalizeStageOrder = (
  stageOrder: StageOrder | undefined,
  tasks: ShapeBuildTaskSummary[],
): StageId[] => {
  const normalized: StageId[] = [];
  const seen = new Set<StageId>();
  const append = (stageId: string) => {
    if (seen.has(stageId)) {
      return;
    }
    seen.add(stageId);
    normalized.push(stageId);
  };
  for (const stageId of stageOrder ?? []) {
    append(stageId);
  }
  for (const task of tasks) {
    append(task.stage);
  }
  return normalized;
};

const buildStageTaskStateById = (
  tasks: ShapeBuildTaskSummary[],
  stageOrder: StageOrder,
  snapshotReceivedByStage: Record<StageId, boolean>,
): BuildStageStateById => {
  const next = new Map<StageId, BuildStageState>(
    stageOrder.map((stageId) => [stageId, createBuildStageState(stageId, Boolean(snapshotReceivedByStage[stageId]))]),
  );
  for (const task of tasks) {
    const stage = task.stage;
    const current = next.get(stage) ?? createBuildStageState(stage, Boolean(snapshotReceivedByStage[stage]));
    if (current.stageTask.length === 0) {
      current.isCompleted = true;
    }
    current.stageTask.push(task);
    if (isTerminalForCompletion(task)) {
      current.stageTaskCompletedById.set(task.taskId, task);
    } else {
      current.isCompleted = false;
    }
    next.set(stage, current);
  }
  return next;
};

const buildTaskCountByStage = (stageBuildStateById: BuildStageStateById): StageCountByStage => {
  const next: StageCountByStage = {};
  stageBuildStateById.forEach((state, stageId) => {
    if (state.stageTask.length > 0) {
      next[stageId] = state.stageTask.length;
    }
  });
  return next;
};

const buildTerminalTaskCountByStage = (
  stageBuildStateById: BuildStageStateById,
): StageCountByStage => {
  const next: StageCountByStage = {};
  stageBuildStateById.forEach((state, stageId) => {
    const completedCount = state.stageTaskCompletedById.size;
    if (completedCount > 0) {
      next[stageId] = completedCount;
    }
  });
  return next;
};

export function useShapeBuildTaskSnapshotProgressState(
  nodeId: NodeId | null,
  options: UseShapeBuildTaskSnapshotProgressOptions = {},
): UseShapeBuildTaskSnapshotProgressState {
  const {
    autoSubscribe = true,
    reportFailures = true,
    onTaskSnapshot,
    stageOrder: stageOrderOverride,
  } = options;
  const bridgeRef = useRef(getBuildWorkerBridge());
  const [tasks, setTasks] = useAtom(tasksAtom);
  const [isLoading, setIsLoading] = useAtom(tasksLoadingAtom);
  const [error, setError] = useAtom(tasksErrorAtom);
  const [isTaskSnapshotProgressConnected, setIsTaskSnapshotProgressConnected] = useState(false);
  const [hasAnyTaskSnapshot, setHasAnyTaskSnapshot] = useState(false);
  const [hasTaskSnapshotByStage, setHasTaskSnapshotByStage] = useState<Record<StageId, boolean>>({});
  const stageOrder = useMemo<StageId[]>(() => (
    normalizeStageOrder(stageOrderOverride, tasks)
  ), [tasks, stageOrderOverride]);
  const stageBuildStateById = useMemo<BuildStageStateById>(() => (
    buildStageTaskStateById(tasks, stageOrder, hasTaskSnapshotByStage)
  ), [tasks, stageOrder, hasTaskSnapshotByStage]);
  const snapshotTaskCountByStage = useMemo<StageCountByStage>(() => (
    buildTaskCountByStage(stageBuildStateById)
  ), [stageBuildStateById]);
  const terminalTaskCountByStage = useMemo<StageCountByStage>(() => (
    buildTerminalTaskCountByStage(stageBuildStateById)
  ), [stageBuildStateById]);
  const reportedFailuresRef = useRef<Set<string>>(new Set());
  const handleSnapshotRef = useRef<(tasks: ShapeBuildTaskSummary[]) => void>(() => { });
  const handleUpdateRef = useRef<(task: RawTaskSummary) => void>(() => { });
  const subscriptionRef = useRef<(() => void) | null>(null);
  const subscriptionIdRef = useRef(0);

  const markTaskSnapshotProgressSynchronized = useCallback(() => {
    setIsTaskSnapshotProgressConnected((current) => (current ? current : true));
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
    markTaskSnapshotProgressSynchronized,
    onTaskSnapshot: (snapshotTasks) => {
      setHasAnyTaskSnapshot(true);
      setHasTaskSnapshotByStage((prev) => {
        const next = markSnapshotReceivedByStage(snapshotTasks, prev);
        if (next === prev) return prev;
        onTaskSnapshot?.(snapshotTasks);
        return next;
      });
    },
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
    setIsTaskSnapshotProgressConnected(false);
    setHasAnyTaskSnapshot(false);
    setHasTaskSnapshotByStage({});
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
      const message = resolveTaskMetadataMessage(task.metadata)
        ?? task.errorMessage
        ?? 'Task failed';
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
      isTaskSnapshotProgressConnected,
      hasAnyTaskSnapshot,
      hasTaskSnapshotByStage,
      stageOrder,
      stageBuildStateById,
      refresh,
      snapshotTaskCountByStage,
      terminalTaskCountByStage,
    }),
    [
      error,
      isLoading,
      isTaskSnapshotProgressConnected,
      hasAnyTaskSnapshot,
      stageOrder,
      refresh,
      hasTaskSnapshotByStage,
      stageBuildStateById,
      snapshotTaskCountByStage,
      terminalTaskCountByStage,
      tasks,
    ],
  );
}
