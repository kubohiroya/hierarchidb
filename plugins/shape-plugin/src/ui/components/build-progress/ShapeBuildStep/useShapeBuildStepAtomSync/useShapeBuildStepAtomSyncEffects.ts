import { useEffect } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { AuthProviderType } from '@hierarchidb/ui-auth';
import type { BuildStatus } from '@hierarchidb/components/build-status';
import type { TaskProgressAuthState, TaskProgressControls, TaskProgressSummary } from '~/ui/atoms/shapeBuildProgressAtoms';
import { shallowEqualRecord } from '~/ui/components/build-progress/shapeBuildStepAtomSyncEquality';

type StageTotalMap = Record<
  string,
  {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
  }
>;

type UseShapeBuildStepAtomSyncAtomEffectsParams = {
  buildStatus: BuildStatus;
  completed: number;
  failed: number;
  hasProgressData: boolean;
  stageTotals: StageTotalMap;
  overallProgress: number;
  skipped: number;
  stageLabel: string;
  taskLabel: string;
  total: number;
  taskUnitLabel: string;
  totalElapsedMs: number;
  timingStageId: string | null;
  completedStageElapsedMs: Record<string, number>;
  stageElapsedMs: number;
  stageRemainingMs: number | null;
  setSummary: Dispatch<SetStateAction<TaskProgressSummary>>;
  setTaskSummaryLoading: Dispatch<SetStateAction<boolean>>;
  isTaskSummaryLoading: boolean;
  setControls: Dispatch<SetStateAction<TaskProgressControls>>;
  setAuth: Dispatch<SetStateAction<TaskProgressAuthState>>;
  canStartOrResume: boolean | undefined;
  statusLabel: string;
  showResumeLabel: boolean | undefined;
  isStartPending: boolean | undefined;
  stopRequested: boolean | undefined;
  stableHandleStartOrResume: () => Promise<void>;
  stableHandlePause: () => void;
  authDialogOpen: boolean | undefined;
  stableCloseAuthDialog: () => void;
  stableHandleProviderSelect: (provider: AuthProviderType) => void;
  summaryRef: MutableRefObject<TaskProgressSummary | null>;
  taskSummaryLoadingRef: MutableRefObject<boolean | null>;
  controlsRef: MutableRefObject<TaskProgressControls | null>;
  authRef: MutableRefObject<TaskProgressAuthState | null>;
};

export const useShapeBuildStepAtomSyncAtomEffects = ({
  buildStatus,
  completed,
  failed,
  hasProgressData,
  stageTotals,
  overallProgress,
  skipped,
  stageLabel,
  taskLabel,
  total,
  taskUnitLabel,
  totalElapsedMs,
  timingStageId,
  completedStageElapsedMs,
  stageElapsedMs,
  stageRemainingMs,
  setSummary,
  setTaskSummaryLoading,
  isTaskSummaryLoading,
  setControls,
  setAuth,
  canStartOrResume,
  statusLabel,
  showResumeLabel,
  isStartPending,
  stopRequested,
  stableHandleStartOrResume,
  stableHandlePause,
  authDialogOpen,
  stableCloseAuthDialog,
  stableHandleProviderSelect,
  summaryRef,
  taskSummaryLoadingRef,
  controlsRef,
  authRef,
}: UseShapeBuildStepAtomSyncAtomEffectsParams): void => {
  useEffect(() => {
    const nextSummary: TaskProgressSummary = {
      stageLabel,
      taskLabel,
      taskUnitLabel,
      overallProgress,
      completed,
      total,
      failed,
      skipped,
      buildStatus,
      hasProgressData,
      timingStageId,
      completedStageElapsedMs,
      totalElapsedMs,
      stageElapsedMs,
      stageRemainingMs,
      stageTotals,
    };
    if (shallowEqualRecord(summaryRef.current, nextSummary)) return;
    summaryRef.current = nextSummary;
    setSummary(nextSummary);
  }, [
    buildStatus,
    completed,
    failed,
    hasProgressData,
    stageTotals,
    overallProgress,
    skipped,
    setSummary,
    stageLabel,
    taskLabel,
    taskUnitLabel,
    total,
    totalElapsedMs,
    timingStageId,
    completedStageElapsedMs,
    stageElapsedMs,
    stageRemainingMs,
    summaryRef,
  ]);

  useEffect(() => {
    if (taskSummaryLoadingRef.current === isTaskSummaryLoading) return;
    taskSummaryLoadingRef.current = isTaskSummaryLoading;
    setTaskSummaryLoading(isTaskSummaryLoading);
  }, [isTaskSummaryLoading, setTaskSummaryLoading, taskSummaryLoadingRef]);

  useEffect(() => {
    const nextControls: TaskProgressControls = {
      canStartOrResume: Boolean(canStartOrResume),
      statusLabel,
      showResumeLabel: Boolean(showResumeLabel),
      startPending: Boolean(isStartPending),
      handleStartOrResume: stableHandleStartOrResume,
      handlePause: stableHandlePause,
      stopRequested: Boolean(stopRequested),
    };
    if (shallowEqualRecord(controlsRef.current, nextControls)) return;
    controlsRef.current = nextControls;
    setControls(nextControls);
  }, [
    canStartOrResume,
    isStartPending,
    stopRequested,
    setControls,
    showResumeLabel,
    statusLabel,
    stableHandlePause,
    stableHandleStartOrResume,
    controlsRef,
  ]);

  useEffect(() => {
    const nextAuth: TaskProgressAuthState = {
      authDialogOpen: Boolean(authDialogOpen),
      closeAuthDialog: stableCloseAuthDialog,
      handleProviderSelect: stableHandleProviderSelect,
    };
    if (shallowEqualRecord(authRef.current, nextAuth)) return;
    authRef.current = nextAuth;
    setAuth(nextAuth);
  }, [authDialogOpen, setAuth, stableCloseAuthDialog, stableHandleProviderSelect, authRef]);
};
