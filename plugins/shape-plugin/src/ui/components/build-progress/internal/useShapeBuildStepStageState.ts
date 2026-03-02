import type { BuildStatus } from '@hierarchidb/components/build-status';
import type { NodeId } from '@hierarchidb/core-types';
import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useMemo, useRef } from 'react';
import type { BuildProgressStatus } from '~/ui/components/build-progress/shapeBuildProgressMapping';
import { hasReceivingTaskSnapshotSignal as detectTaskSnapshotSignal } from '~/ui/components/build-progress/receivingTaskSnapshotSignal';
import { persistedTasksAtom } from '~/ui/atoms/shapeBuildProgressAtoms';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';
import type { TaskListViewPhase } from '~/ui/atoms/shapeBuildProgressAtoms';
import {
  useShapeBuildTaskSnapshotProgressState,
  type StageId,
  type BuildStageStateById,
} from '~/ui/components/build-progress/useShapeBuildTaskSnapshotProgressState/useShapeBuildTaskSnapshotProgressState';
import { areTaskListsEquivalentForView } from '~/ui/components/build-progress/useShapeBuildTaskSync/useShapeBuildTaskSync.comparison.utils';
import { resolveMostAdvancedInFlightStageId, resolveMostAdvancedRunningStageId } from '~/ui/components/build-progress/internal/useShapeBuildStepHelpers/stage';
import { resolveDisplayBuildStatus } from '~/ui/components/build-progress/internal/useShapeBuildStepHelpers/status';

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

type ProcessingStatus = 'idle' | 'processing' | 'paused' | 'completed' | 'failed';

type Args = {
  activeNodeId: NodeId | null;
  isSessionStopping: boolean;
  stages: StageLike[];
  processingStatus: ProcessingStatus;
  runtimeStatus: BuildProgressStatus['status'];
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

export type UseShapeBuildStepStageStateReturn = {
  tasks: ShapeBuildTaskSummary[];
  isLoading: boolean;
  isTaskSnapshotProgressConnected: boolean;
  stageFromState: string | null;
  liveStageFromState: string | undefined;
  resolvedStageFromState: string | undefined;
  buildStatus: BuildStatus;
  hasReceivingTaskSnapshotSignal: boolean;
  hasProgressTaskSignal: boolean;
  hasInFlightTasks: boolean;
  hasStartedTasks: boolean;
  hasQueuedTasks: boolean;
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

const resolveTaskListViewPhase = (input: {
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
    || input.baseBuildStatus === 'running'
    || input.hasProgressTaskSignal
    || (input.baseBuildStatus === 'paused' && !input.hasAnyTaskSnapshot)
  ) {
    return 'awaitingSnapshot';
  }
  if (input.baseBuildStatus === 'idle') {
    return 'idle';
  }
  return 'settledEmpty';
};

export const useShapeBuildStepStageState = ({
  activeNodeId,
  isSessionStopping,
  stages,
  effectiveProgress,
  sessionProgressTotal,
  reportFailures,
  baseBuildStatus,
  onTerminalStageCompletion,
}: Args): UseShapeBuildStepStageStateReturn => {
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
  const {
    tasks,
    isLoading,
    isTaskSnapshotProgressConnected,
    hasAnyTaskSnapshot,
    hasTaskSnapshotByStage,
    stageOrder: resolvedStageOrder,
    stageBuildStateById,
    snapshotTaskCountByStage,
    terminalTaskCountByStage,
  } = useShapeBuildTaskSnapshotProgressState(activeNodeId, {
    reportFailures,
    stageOrder: configuredStageOrder,
  });

  const persistedTasks = useAtomValue(persistedTasksAtom);
  const setPersistedTasks = useSetAtom(persistedTasksAtom);
  const lastPersistedNodeIdRef = useRef<NodeId | null>(null);

  useEffect(() => {
    const currentNodeId = activeNodeId ?? null;
    if (lastPersistedNodeIdRef.current && lastPersistedNodeIdRef.current !== currentNodeId) {
      setPersistedTasks([]);
    }
    lastPersistedNodeIdRef.current = currentNodeId;
  }, [activeNodeId, setPersistedTasks]);

  useEffect(() => {
    if (tasks.length === 0) return;
    if (areTaskListsEquivalentForView(persistedTasks, tasks)) return;
    setPersistedTasks(tasks);
  }, [persistedTasks, setPersistedTasks, tasks]);

  const rawDisplayTasks = tasks.length > 0 ? tasks : persistedTasks;
  const displayTasks = useMemo<ShapeBuildTaskSummary[]>(() => (
    isSessionStopping
      ? rawDisplayTasks.map((task: ShapeBuildTaskSummary) => (
        task.status === 'running'
          ? { ...task, status: 'queued' }
          : task
      ))
      : rawDisplayTasks
  ), [isSessionStopping, rawDisplayTasks]);

  const hasInFlightTasks = useMemo(() => (
    displayTasks.some((task) => task.status === 'running' || task.status === 'queued')
  ), [displayTasks]);
  const hasStartedTasks = useMemo(() => (
    displayTasks.some((task) => (
      task.status === 'running'
      || task.status === 'completed'
      || task.status === 'recycled'
      || task.status === 'failed'
    ))
  ), [displayTasks]);
  const hasQueuedTasks = useMemo(() => (
    displayTasks.some((task) => task.status === 'queued')
  ), [displayTasks]);

  const taskProgressTotal = effectiveProgress?.status?.progress ?? sessionProgressTotal;
  const hasProgressTaskSignal = detectTaskSnapshotSignal({
    hasStartedTasks,
    hasQueuedTasks,
    progressTaskId: effectiveProgress?.progressTaskId ?? null,
    progressTotal: taskProgressTotal,
  });
  const hasReceivingTaskSnapshotSignal = isTaskSnapshotProgressConnected && hasAnyTaskSnapshot;
  const taskListViewPhase = useMemo<TaskListViewPhase>(() => (
    resolveTaskListViewPhase({
      baseBuildStatus,
      displayTaskCount: displayTasks.length,
      isLoading,
      hasProgressTaskSignal,
      hasAnyTaskSnapshot,
    })
  ), [
    baseBuildStatus,
    displayTasks.length,
    hasAnyTaskSnapshot,
    hasProgressTaskSignal,
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
    hasReceivingTaskSnapshotSignal,
    hasProgressTaskSignal,
    hasInFlightTasks,
    hasStartedTasks,
    hasQueuedTasks,
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
