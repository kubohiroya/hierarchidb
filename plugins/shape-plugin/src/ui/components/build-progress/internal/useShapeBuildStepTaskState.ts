import type { BuildStatus } from '@hierarchidb/components/build-status';
import type { NodeId } from '@hierarchidb/core-types';
import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useMemo, useRef } from 'react';
import type { BuildProgressStatus } from '~/ui/components/build-progress/shapeBuildProgressMapping';
import { hasAwaitingFirstTaskSignal } from '~/ui/components/build-progress/awaitingFirstTaskSignal';
import { persistedTasksAtom } from '~/ui/atoms/shapeBuildProgressAtoms';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';
import { useShapeBuildTasks } from '~/ui/components/build-progress/useShapeBuildTasks/useShapeBuildTasks';
import { resolveMostAdvancedInFlightStageId, resolveMostAdvancedRunningStageId } from '~/ui/components/build-progress/internal/useShapeBuildStepHelpers/stage';
import { resolveDisplayBuildStatus } from '~/ui/components/build-progress/internal/useShapeBuildStepHelpers/status';
import { isTerminalTask } from '~/ui/components/build-progress/useShapeBuildTaskSync/useShapeBuildTaskSync.comparison.utils.js';

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
  onVtStageCompletion?: (options: {
    completed: boolean;
    hasFailedVtTasks: boolean;
  }) => void;
};

export type UseShapeBuildStepTaskStateReturn = {
  tasks: ShapeBuildTaskSummary[];
  isLoading: boolean;
  isTaskStreamReady: boolean;
  stageFromState: string | null;
  liveStageFromState: string | undefined;
  resolvedStageFromState: string | undefined;
  buildStatus: BuildStatus;
  hasFirstTaskSignal: boolean;
  hasProgressTaskSignal: boolean;
  hasInFlightTasks: boolean;
  hasStartedTasks: boolean;
  hasQueuedTasks: boolean;
  runningStageIdFromTasks: string | null;
  inFlightStageIdFromTasks: string | null;
  snapshotTaskCountByStage: Record<string, number>;
  terminalTaskCountByStage: Record<string, number>;
  hasFailedFetchTasks: boolean;
  taskProgressTotal: number | undefined;
  sessionProgressTotal: number | undefined;
  refreshTasks: () => void;
  tasksCompletionStatus: BuildStatus | null;
  stageTaskCompletedById: Record<string, boolean>;
  isVtStageCompleted: boolean;
};

export const useShapeBuildStepTaskState = ({
  activeNodeId,
  isSessionStopping,
  stages,
  effectiveProgress,
  sessionProgressTotal,
  reportFailures,
  baseBuildStatus,
  onVtStageCompletion,
}: Args): UseShapeBuildStepTaskStateReturn => {
  const {
    tasks,
    isLoading,
    isTaskStreamReady,
    refresh,
    snapshotTaskCountByStage,
    terminalTaskCountByStage,
  } = useShapeBuildTasks(activeNodeId, {
    reportFailures,
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
    setPersistedTasks(tasks);
  }, [setPersistedTasks, tasks]);

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
  const hasProgressTaskSignal = hasAwaitingFirstTaskSignal({
    hasStartedTasks,
    hasQueuedTasks,
    progressTaskId: effectiveProgress?.progressTaskId ?? null,
    progressTotal: taskProgressTotal,
  });
  const hasFirstTaskSignal = hasAwaitingFirstTaskSignal({
    hasStartedTasks,
    hasQueuedTasks,
    progressTaskId: effectiveProgress?.progressTaskId ?? null,
    progressTotal: taskProgressTotal,
  });

  const stageTaskGroups = useMemo(() => {
    const grouped = new Map<string, ShapeBuildTaskSummary[]>();
    for (const task of displayTasks) {
      const current = grouped.get(task.stage) ?? [];
      current.push(task);
      grouped.set(task.stage, current);
    }
    return grouped;
  }, [displayTasks]);

  const stageTaskCompletedById = useMemo(() => {
    const completed: Record<string, boolean> = {};
    stageTaskGroups.forEach((groupTasks, stageId) => {
      if (groupTasks.length === 0) return;
      const allTerminal = groupTasks.every((task) => isTerminalTask(task));
      if (allTerminal) {
        completed[stageId] = true;
      }
    });
    return completed;
  }, [stageTaskGroups]);

  const isVtStageCompleted = useMemo(() => {
    const vtTasks = stageTaskGroups.get('vt') ?? [];
    if (vtTasks.length === 0) return false;
    return vtTasks.every((task) => isTerminalTask(task));
  }, [stageTaskGroups]);

  const hasFailedVtTasks = useMemo(() => (
    displayTasks.some((task) => task.status === 'failed' && task.stage === 'vt')
  ), [displayTasks]);

  const vtCompletionNotifiedRef = useRef(false);
  useEffect(() => {
    if (!onVtStageCompletion) return;
    if (!isVtStageCompleted) {
      vtCompletionNotifiedRef.current = false;
      return;
    }
    if (vtCompletionNotifiedRef.current) return;
    vtCompletionNotifiedRef.current = true;
    onVtStageCompletion({
      completed: true,
      hasFailedVtTasks,
    });
  }, [isVtStageCompleted, hasFailedVtTasks, onVtStageCompletion]);

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
    isTaskStreamReady,
    stageFromState: stageFromState ?? null,
    liveStageFromState,
    resolvedStageFromState,
    buildStatus,
    hasFirstTaskSignal,
    hasProgressTaskSignal,
    hasInFlightTasks,
    hasStartedTasks,
    hasQueuedTasks,
    runningStageIdFromTasks,
    inFlightStageIdFromTasks,
    snapshotTaskCountByStage,
    terminalTaskCountByStage,
    hasFailedFetchTasks: displayTasks.some((task) => task.status === 'failed' && (task.stage === 'fetch')),
    taskProgressTotal,
    sessionProgressTotal,
    refreshTasks: refresh,
    tasksCompletionStatus,
    stageTaskCompletedById,
    isVtStageCompleted,
  };
};
