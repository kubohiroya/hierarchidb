import type { BuildStatus } from '@hierarchidb/ui-build-progress/build-status';
import type { NodeId } from '@hierarchidb/core-types';
import { useAtomValue } from 'jotai';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildSessionLifecycleAtom,
  buildSessionTasksByStageAtom,
} from '~/ui/atoms/buildSessionStateAtoms';
import type { BuildSessionDisplayStatus } from '~/ui/components/build-progress/shapeBuildProgressTypes';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressTypes';
import type { TaskListViewPhase } from '~/ui/atoms/shapeBuildProgressTypes';
import { areTaskListsEquivalentForView } from '~/ui/components/build-progress/useShapeBuildTaskSync/useShapeBuildTaskSync.comparisonUtils';
import { resolveMostAdvancedInFlightStageId, resolveMostAdvancedRunningStageId } from '~/ui/components/build-progress/internal/useShapeBuildSessionHelpers/stage';
import { resolveDisplayBuildStatus } from '~/ui/components/build-progress/internal/useShapeBuildSessionHelpers/status';

type StageLike = {
  id: string;
};

type ProgressLike = {
  percentage?: number;
  stage?: string | null;
  progressTaskId?: string | null;
  progressTaskStage?: string | null;
  status?: {
    progress?: number;
  };
};

type ProcessingStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';
type StageId = string;
type StageCountByStage = Record<StageId, number>;
type BuildStageState = {
  stage: StageId;
  stageTask: ShapeBuildTaskSummary[];
  stageTaskCompletedById: Map<string, ShapeBuildTaskSummary>;
  isCompleted: boolean;
  hasSnapshot: boolean;
};
type BuildStageStateById = Map<StageId, BuildStageState>;

type Args = {
  activeNodeId: NodeId | null;
  stages: StageLike[];
  processingStatus: ProcessingStatus;
  runtimeStatus: BuildSessionDisplayStatus['status'];
  effectiveProgress: ProgressLike | null;
  sessionProgressTotal?: number;
  reportFailures: boolean;
  baseBuildStatus: BuildStatus;
  hasNodeId: boolean;
  onTerminalStageCompletion?: (options: {
    completed: boolean;
    hasFailedTerminalTasks: boolean;
  }) => void;
};

export type UseShapeBuildSessionStageStateReturn = {
  tasks: ShapeBuildTaskSummary[];
  isLoading: boolean;
  isTaskSnapshotProgressConnected: boolean;
  stageFromState: string | null;
  liveStageFromState: string | undefined;
  resolvedStageFromState: string | undefined;
  buildStatus: BuildStatus;
  hasInFlightTasks: boolean;
  stageOrder: StageId[];
  runningStageIdFromTasks: string | null;
  inFlightStageIdFromTasks: string | null;
  snapshotTaskCountByStage: Record<string, number>;
  terminalTaskCountByStage: Record<string, number>;
  hasFailedSourceTasks: boolean;
  taskListViewPhase: TaskListViewPhase;
  taskProgressTotal: number | undefined;
  sessionProgressTotal: number | undefined;
  tasksCompletionStatus: BuildStatus | null;
  stageTaskCompletedById: Record<string, boolean>;
  hasTaskSnapshotByStage: Record<string, boolean>;
  stageBuildStateById: BuildStageStateById;
  isTerminalStageCompleted: boolean;
  terminalStageId: StageId | null;
};

export const resolveTaskListViewPhase = (input: {
  baseBuildStatus: BuildStatus;
  displayTaskCount: number;
  isLoading: boolean;
  hasProgressTaskSignal: boolean;
  hasAnyTaskSnapshot: boolean;
}): TaskListViewPhase => {
  if (input.displayTaskCount > 0) {
    return 'streaming';
  }
  if (
    input.isLoading
    || input.hasProgressTaskSignal
    || (input.baseBuildStatus === 'paused' && !input.hasAnyTaskSnapshot)
  ) {
    return 'ui-initializing';
  }
  if (input.baseBuildStatus === 'idle') {
    return 'idle';
  }
  return 'settledEmpty';
};

export const shouldClearPersistedTasksOnReset = (input: {
  runtimePhase: string;
  taskCount: number;
}): boolean => (
  input.taskCount === 0
  && input.runtimePhase === 'idle'
);

export const resolveDisplayTasks = (input: {
  runtimePhase: string;
  tasks: ShapeBuildTaskSummary[];
  persistedTasks: ShapeBuildTaskSummary[];
}): ShapeBuildTaskSummary[] => {
  if (input.tasks.length > 0) {
    return input.tasks;
  }
  if (
    shouldClearPersistedTasksOnReset({
      runtimePhase: input.runtimePhase,
      taskCount: input.tasks.length,
    })
  ) {
    return input.tasks;
  }
  return input.persistedTasks;
};

export const useShapeBuildSessionStageState = ({
  activeNodeId,
  stages,
  effectiveProgress,
  sessionProgressTotal,
  reportFailures,
  baseBuildStatus,
  onTerminalStageCompletion,
}: Args): UseShapeBuildSessionStageStateReturn => {
  void reportFailures;
  const configuredStageOrder = useMemo(() => stages.map((stage) => stage.id), [stages]);
  const terminalStageId = useMemo<StageId | null>(() => {
    if (configuredStageOrder.length <= 0) {
      return null;
    }
    return configuredStageOrder[configuredStageOrder.length - 1] as StageId;
  }, [configuredStageOrder]);
  const restartFailureStageId = useMemo<StageId | null>(() => {
    if (configuredStageOrder.length <= 0) {
      return null;
    }
    return configuredStageOrder[0] as StageId;
  }, [configuredStageOrder]);
  const runtime = useAtomValue(buildSessionLifecycleAtom);
  const tasksByStage = useAtomValue(buildSessionTasksByStageAtom);

  const tasks = useMemo<ShapeBuildTaskSummary[]>(() => {
    const next: ShapeBuildTaskSummary[] = [];
    for (const stageId of configuredStageOrder) {
      const stageTasks = tasksByStage[stageId as keyof typeof tasksByStage] ?? [];
      for (const task of stageTasks) {
        const summary: ShapeBuildTaskSummary = {
          taskId: task.taskId,
          version: task.version,
          stage: task.stage,
          status: task.status,
          progress: task.progress,
          sequence: task.sequence,
          metadata: task.metadata,
          display: task.display,
          index: task.sequence,
          nodeId: activeNodeId ?? undefined,
        };
        next.push(summary);
      }
    }
    return next;
  }, [activeNodeId, configuredStageOrder, tasksByStage]);

  const hasTaskSnapshotByStage = useMemo<Record<StageId, boolean>>(() => {
    const next: Record<StageId, boolean> = {};
    for (const stageId of configuredStageOrder) {
      const stageTasks = tasksByStage[stageId as keyof typeof tasksByStage] ?? [];
      next[stageId] = stageTasks.length > 0;
    }
    return next;
  }, [configuredStageOrder, tasksByStage]);

  const hasAnyTaskSnapshot = tasks.length > 0;
  const isTaskSnapshotProgressConnected = Boolean(activeNodeId);
  const isLoading = useMemo(() => {
    if (!activeNodeId) return false;
    if (hasAnyTaskSnapshot) return false;
    const phase = runtime.phase;
    return phase === 'starting' || phase === 'running' || phase === 'resuming' || phase === 'pausing';
  }, [activeNodeId, hasAnyTaskSnapshot, runtime.phase]);

  const resolvedStageOrder = configuredStageOrder;

  const stageBuildStateById = useMemo<BuildStageStateById>(() => {
    const next = new Map<StageId, BuildStageState>();
    for (const stageId of resolvedStageOrder) {
      next.set(stageId, {
        stage: stageId,
        stageTask: [],
        stageTaskCompletedById: new Map<string, ShapeBuildTaskSummary>(),
        isCompleted: false,
        hasSnapshot: Boolean(hasTaskSnapshotByStage[stageId]),
      });
    }
    for (const task of tasks) {
      const stage = task.stage;
      const current = next.get(stage) ?? {
        stage,
        stageTask: [],
        stageTaskCompletedById: new Map<string, ShapeBuildTaskSummary>(),
        isCompleted: false,
        hasSnapshot: Boolean(hasTaskSnapshotByStage[stage]),
      };
      if (current.stageTask.length === 0) {
        current.isCompleted = true;
      }
      current.stageTask.push(task);
      if (task.status === 'completed' || task.status === 'failed' || task.status === 'recycled') {
        current.stageTaskCompletedById.set(task.taskId, task);
      } else {
        current.isCompleted = false;
      }
      next.set(stage, current);
    }
    return next;
  }, [hasTaskSnapshotByStage, resolvedStageOrder, tasks]);

  const snapshotTaskCountByStage = useMemo<StageCountByStage>(() => {
    const next: StageCountByStage = {};
    stageBuildStateById.forEach((state, stageId) => {
      if (state.stageTask.length > 0) next[stageId] = state.stageTask.length;
    });
    return next;
  }, [stageBuildStateById]);

  const terminalTaskCountByStage = useMemo<StageCountByStage>(() => {
    const next: StageCountByStage = {};
    stageBuildStateById.forEach((state, stageId) => {
      if (state.stageTaskCompletedById.size > 0) next[stageId] = state.stageTaskCompletedById.size;
    });
    return next;
  }, [stageBuildStateById]);

  const [persistedTasks, setPersistedTasks] = useState<ShapeBuildTaskSummary[]>([]);
  const lastPersistedNodeIdRef = useRef<NodeId | null>(null);

  // Stable key derived from task identity + state to avoid re-firing on reference changes
  const tasksKey = useMemo(
    () => tasks.map((t) => `${t.taskId}:${t.version}:${t.status}:${t.progress}`).join('|'),
    [tasks],
  );

  useEffect(() => {
    const currentNodeId = activeNodeId ?? null;
    if (lastPersistedNodeIdRef.current && lastPersistedNodeIdRef.current !== currentNodeId) {
      setPersistedTasks(() => []);
    }
    lastPersistedNodeIdRef.current = currentNodeId;
  }, [activeNodeId]);

  useEffect(() => {
    if (tasks.length === 0) return;
    setPersistedTasks((previous) => (
      areTaskListsEquivalentForView(previous, tasks) ? previous : tasks
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasksKey]);

  useEffect(() => {
    if (!shouldClearPersistedTasksOnReset({
      runtimePhase: runtime.phase,
      taskCount: tasks.length,
    })) {
      return;
    }
    setPersistedTasks([]);
  }, [runtime.phase, tasks.length]);

  const displayTasks = resolveDisplayTasks({
    runtimePhase: runtime.phase,
    tasks,
    persistedTasks,
  });

  const hasInFlightTasks = useMemo(() => (
    displayTasks.some((task) => task.status === 'running' || task.status === 'queued')
  ), [displayTasks]);

  const taskProgressTotal = effectiveProgress?.status?.progress ?? sessionProgressTotal;
  const taskListViewPhase = useMemo<TaskListViewPhase>(() => (
    resolveTaskListViewPhase({
      baseBuildStatus,
      displayTaskCount: displayTasks.length,
      isLoading,
      hasProgressTaskSignal: false, // Simplified - no longer needed with SSOT
      hasAnyTaskSnapshot,
    })
  ), [
    baseBuildStatus,
    displayTasks.length,
    hasAnyTaskSnapshot,
    isLoading,
  ]);

  const stageTaskCompletedById = useMemo(() => {
    const completed: Record<string, boolean> = {};
    stageBuildStateById.forEach((state, stageId) => {
      if (state.isCompleted) {
        completed[stageId] = true;
      }
    });
    return completed;
  }, [stageBuildStateById]);

  const isTerminalStageCompleted = useMemo(() => {
    if (!terminalStageId) {
      return false;
    }
    const terminalTaskState = stageBuildStateById.get(terminalStageId);
    if (!terminalTaskState || terminalTaskState.stageTask.length === 0) {
      return false;
    }
    return terminalTaskState.isCompleted;
  }, [stageBuildStateById, terminalStageId]);

  const hasFailedRestartStageTasks = useMemo(() => {
    if (!restartFailureStageId) {
      return false;
    }
    return displayTasks.some((task) => task.status === 'failed' && task.stage === restartFailureStageId);
  }, [displayTasks, restartFailureStageId]);

  const hasFailedTerminalTasks = useMemo(() => (
    displayTasks.some((task) => (
      task.status === 'failed'
      && terminalStageId !== null
      && task.stage === terminalStageId
    ))
  ), [displayTasks, terminalStageId]);

  const terminalCompletionNotifiedRef = useRef(false);
  useEffect(() => {
    if (!onTerminalStageCompletion) return;
    if (!isTerminalStageCompleted || hasInFlightTasks) {
      terminalCompletionNotifiedRef.current = false;
      return;
    }
    if (terminalCompletionNotifiedRef.current) return;
    terminalCompletionNotifiedRef.current = true;
    onTerminalStageCompletion({
      completed: true,
      hasFailedTerminalTasks,
    });
  }, [
    hasFailedTerminalTasks,
    hasInFlightTasks,
    isTerminalStageCompleted,
    onTerminalStageCompletion,
  ]);

  const tasksCompletionStatus = useMemo<BuildStatus | null>(() => {
    if (displayTasks.length === 0) return null;
    if (hasInFlightTasks) return null;
    const hasFailed = displayTasks.some((task) => task.status === 'failed');
    return hasFailed ? 'failed' : 'completed';
  }, [displayTasks, hasInFlightTasks]);

  const buildStatus = useMemo<BuildStatus>(() => resolveDisplayBuildStatus({
    baseBuildStatus,
    tasksCompletionStatus,
    hasInFlightTasks,
  }), [baseBuildStatus, hasInFlightTasks, tasksCompletionStatus]);

  const stageFromState = effectiveProgress?.stage ?? null;
  const liveStageFromState = stageFromState ?? undefined;
  const resolvedStageFromState = liveStageFromState ?? stages[0]?.id;

  const runningStageIdFromTasks = useMemo(() => resolveMostAdvancedRunningStageId({
    stages,
    tasks: displayTasks,
  }), [displayTasks, stages]);
  const inFlightStageIdFromTasks = useMemo(() => resolveMostAdvancedInFlightStageId({
    stages,
    tasks: displayTasks,
  }), [displayTasks, stages]);

  return {
    tasks: displayTasks,
    isLoading,
    isTaskSnapshotProgressConnected,
    stageFromState: stageFromState ?? null,
    liveStageFromState,
    resolvedStageFromState,
    buildStatus,
    hasInFlightTasks,
    stageOrder: resolvedStageOrder,
    runningStageIdFromTasks,
    inFlightStageIdFromTasks,
    snapshotTaskCountByStage,
    terminalTaskCountByStage,
    hasTaskSnapshotByStage,
    stageBuildStateById,
    hasFailedSourceTasks: hasFailedRestartStageTasks,
    taskListViewPhase,
    isTerminalStageCompleted,
    terminalStageId,
    taskProgressTotal,
    sessionProgressTotal,
    tasksCompletionStatus,
    stageTaskCompletedById,
  };
};
