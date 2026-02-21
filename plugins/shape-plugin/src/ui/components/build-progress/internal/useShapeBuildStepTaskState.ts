import type { BuildStatus } from '@hierarchidb/components/build-status';
import type { NodeId } from '@hierarchidb/core-types';
import { useAtomValue, useSetAtom } from 'jotai';
import { useEffect, useMemo, useRef } from 'react';
import type { BuildProgressStatus } from '~/ui/components/build-progress/shapeBuildProgressMapping';
import { hasAwaitingFirstTaskSignal } from '~/ui/components/build-progress/awaitingFirstTaskSignal';
import { persistedTasksAtom } from '~/ui/atoms/shapeBuildProgressAtoms';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';
import { useShapeBuildTasks } from '~/ui/components/build-progress/useShapeBuildTasks/useShapeBuildTasks';
import { normalizeStageKey } from '~/ui/components/build-progress/internal/useShapeBuildStepHelpers/stage';
import { resolveMostAdvancedInFlightStageId, resolveMostAdvancedRunningStageId } from '~/ui/components/build-progress/internal/useShapeBuildStepHelpers/stage';
import { resolveDisplayBuildStatus, shouldRefreshTasksSnapshot } from '~/ui/components/build-progress/internal/useShapeBuildStepHelpers/status';

type StageLike = {
  id: string;
};

type ProgressLike = {
  percentage?: number;
  taskType?: string | null;
  progressTaskId?: string | null;
  progressTaskStage?: string | null;
  status?: {
    progress?: number;
  };
};

type StatusLike = {
  status?: {
    status?: BuildProgressStatus['status'];
  };
};

type ProcessingStatus = 'idle' | 'processing' | 'paused' | 'completed' | 'failed';

type Args = {
  activeNodeId: NodeId | null;
  isSessionStopping: boolean;
  buildSessionTransitionActive: boolean;
  stages: StageLike[];
  processingStatus: ProcessingStatus;
  runtimeStatus: BuildProgressStatus['status'];
  effectiveProgress: ProgressLike | null;
  effectiveStatus: StatusLike | null;
  sessionProgressTotal?: number;
  reportFailures: boolean;
  baseBuildStatus: BuildStatus;
  hasNodeId: boolean;
};

export type UseShapeBuildStepTaskStateReturn = {
  tasks: ShapeBuildTaskSummary[];
  isLoading: boolean;
  isTaskStreamReady: boolean;
  taskType: string | null;
  liveTaskType: string | undefined;
  resolvedTaskType: string | undefined;
  buildStatus: BuildStatus;
  hasFirstTaskSignal: boolean;
  hasProgressTaskSignal: boolean;
  hasInFlightTasks: boolean;
  hasStartedTasks: boolean;
  hasQueuedTasks: boolean;
  runningStageIdFromTasks: string | null;
  inFlightStageIdFromTasks: string | null;
  completedTaskSequenceById: Map<string, number>;
  hasFailedFetchTasks: boolean;
  taskProgressTotal: number | undefined;
  sessionProgressTotal: number | undefined;
  refreshTasks: () => void;
  tasksCompletionStatus: BuildStatus | null;
};

export const useShapeBuildStepTaskState = ({
  activeNodeId,
  isSessionStopping,
  buildSessionTransitionActive,
  stages,
  processingStatus,
  runtimeStatus,
  effectiveProgress,
  effectiveStatus,
  sessionProgressTotal,
  reportFailures,
  baseBuildStatus,
}: Args): UseShapeBuildStepTaskStateReturn => {
  const { tasks, isLoading, isTaskStreamReady, refresh } = useShapeBuildTasks(activeNodeId, {
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

  const completedTaskSequenceById = useMemo(() => {
    const map = new Map<string, number>();
    displayTasks.forEach((task) => {
      if (task.status !== 'completed' && task.status !== 'recycled') return;
      if (!(typeof task.sequence === 'number' && Number.isFinite(task.sequence))) return;
      const current = map.get(task.taskId);
      if (current === undefined || task.sequence > current) {
        map.set(task.taskId, task.sequence);
      }
    });
    return map;
  }, [displayTasks]);

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

  const lastTaskRefreshRef = useRef<{ nodeId: string; at: number } | null>(null);
  useEffect(() => {
    const shouldRefresh = shouldRefreshTasksSnapshot({
      displayTaskCount: displayTasks.length,
      hasInFlightTasks,
      hasProgressTaskSignal,
      buildStatus,
      runtimeStatus,
      processingStatus,
      buildSessionTransitionActive,
    });
    if (!shouldRefresh) return;
    if (!activeNodeId) return;
    const now = Date.now();
    const last = lastTaskRefreshRef.current;
    if (last && last.nodeId === String(activeNodeId) && now - last.at < 2000) {
      return;
    }
    lastTaskRefreshRef.current = { nodeId: String(activeNodeId), at: now };
    void refresh();
  }, [
    activeNodeId,
    buildStatus,
    buildSessionTransitionActive,
    displayTasks.length,
    hasInFlightTasks,
    hasProgressTaskSignal,
    processingStatus,
    refresh,
    runtimeStatus,
    hasProgressTaskSignal,
  ]);

  const taskType = effectiveProgress?.taskType ?? null;
  const liveTaskType = taskType ?? effectiveStatus?.status?.status;
  const resolvedTaskType = liveTaskType ?? stages[0]?.id;

  const runningStageIdFromTasks = useMemo(() => resolveMostAdvancedRunningStageId({
    stages,
    tasks: displayTasks,
  }), [displayTasks, stages]);
  const inFlightStageIdFromTasks = useMemo(() => resolveMostAdvancedInFlightStageId({
    stages,
    tasks: displayTasks,
  }), [displayTasks, stages]);

  const hasFailedFetchTasks = useMemo(() => (
    displayTasks.some((task) => task.status === 'failed' && normalizeStageKey(task) === 'fetch')
  ), [displayTasks]);

  return {
    tasks: displayTasks,
    isLoading,
    isTaskStreamReady,
    taskType: taskType ?? null,
    liveTaskType,
    resolvedTaskType,
    buildStatus,
    hasFirstTaskSignal,
    hasProgressTaskSignal,
    hasInFlightTasks,
    hasStartedTasks,
    hasQueuedTasks,
    runningStageIdFromTasks,
    inFlightStageIdFromTasks,
    completedTaskSequenceById,
    hasFailedFetchTasks,
    taskProgressTotal,
    sessionProgressTotal,
    refreshTasks: refresh,
    tasksCompletionStatus,
  };
};
