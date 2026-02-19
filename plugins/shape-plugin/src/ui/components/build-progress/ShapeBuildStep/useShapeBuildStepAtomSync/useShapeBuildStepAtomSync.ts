import { useEffect, useRef } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import { useSetAtom } from 'jotai';
import type { AuthProviderType } from '@hierarchidb/ui-auth';
import {
  taskStatusAtom,
  taskPaneProgressAtom,
  taskProgressAuthAtom,
  taskProgressControlsAtom,
  taskProgressSummaryAtom,
  taskSummaryLoadingAtom,
  tasksByStageAtom,
  taskWarningMessageAtom,
  crashSuspectMessageAtom,
  crashSuspectOpenAtom,
  crashSuspectControlsAtom,
  suspendSuspectMessageAtom,
  suspendSuspectOpenAtom,
  suspendSuspectControlsAtom,
  buildStageProgressAtom,
  buildStagesAtom,
} from '~/ui/atoms/shapeBuildProgressAtoms';
import { useShapeBuildStepAtomSyncCallbacks } from './useShapeBuildStepAtomSyncCallbacks.js';
import { useShapeBuildStepAtomSyncAtomEffects } from './useShapeBuildStepAtomSyncEffects.js';
import type { ShapeDialogStepProps } from '~/ui/components/ShapeDialogStepProps';
import { useShapeBuildStep } from '~/ui/components/build-progress/internal/useShapeBuildStepLogic';

export const useShapeBuildStepAtomSync = ({ data, onChange, nodeId }: ShapeDialogStepProps) => {
  const resolvedNodeId = nodeId as NodeId | undefined;
  const {
    stages,
    stageProgress,
    paneProgress,
    tasksByStage,
    buildStatus,
    overallProgress,
    stageLabel,
    taskLabel,
    taskUnitLabel,
    statusLabel,
    completed,
    total,
    failed,
    skipped,
    hasProgressData,
    stageTotals,
    timingStageId,
    completedStageElapsedMs,
    totalElapsedMs,
    stageElapsedMs,
    stageRemainingMs,
    isTaskSummaryLoading,
    warningMessage,
    crashSuspectOpen,
    crashSuspectMessage,
    setCrashSuspectOpen: setCrashSuspectOpenFromHook,
    suspendSuspectOpen,
    suspendSuspectMessage,
    setSuspendSuspectOpen: setSuspendSuspectOpenFromHook,
    canStartOrResume,
    showResumeLabel,
    handleStartOrResume,
    handlePause,
    isStartPending,
    stopRequested,
    authDialogOpen,
    closeAuthDialog,
    handleProviderSelect,
  } = useShapeBuildStep({ data, onChange, nodeId: resolvedNodeId });

  const setStages = useSetAtom(buildStagesAtom);
  const setStageProgress = useSetAtom(buildStageProgressAtom);
  const setPaneProgress = useSetAtom(taskPaneProgressAtom);
  const setTasksByStage = useSetAtom(tasksByStageAtom);
  const setBuildStatus = useSetAtom(taskStatusAtom);
  const setSummary = useSetAtom(taskProgressSummaryAtom);
  const setTaskSummaryLoading = useSetAtom(taskSummaryLoadingAtom);
  const setWarningMessage = useSetAtom(taskWarningMessageAtom);
  const setCrashSuspectMessage = useSetAtom(crashSuspectMessageAtom);
  const setCrashSuspectOpen = useSetAtom(crashSuspectOpenAtom);
  const setCrashSuspectControls = useSetAtom(crashSuspectControlsAtom);
  const setSuspendSuspectMessage = useSetAtom(suspendSuspectMessageAtom);
  const setSuspendSuspectOpen = useSetAtom(suspendSuspectOpenAtom);
  const setSuspendSuspectControls = useSetAtom(suspendSuspectControlsAtom);
  const setControls = useSetAtom(taskProgressControlsAtom);
  const setAuth = useSetAtom(taskProgressAuthAtom);

  const stagesRef = useRef<typeof stages | null>(null);
  const stageProgressRef = useRef<typeof stageProgress | null>(null);
  const paneProgressRef = useRef<typeof paneProgress | null>(null);
  const tasksByStageRef = useRef<typeof tasksByStage | null>(null);
  const buildStatusRef = useRef<typeof buildStatus | null>(null);
  const summaryRef = useRef<{
    stageLabel: string;
    taskLabel: string;
    taskUnitLabel: string;
    overallProgress: number;
    completed: number;
    total: number;
    failed: number;
    skipped: number;
    buildStatus: typeof buildStatus;
    hasProgressData: boolean;
    timingStageId: string | null;
    completedStageElapsedMs: typeof completedStageElapsedMs;
    totalElapsedMs: number;
    stageElapsedMs: number;
    stageRemainingMs: number | null;
    stageTotals: typeof stageTotals;
  } | null>(null);
  const taskSummaryLoadingRef = useRef<boolean | null>(null);
  const warningMessageRef = useRef<string | null>(null);
  const crashSuspectMessageRef = useRef<string | null>(null);
  const crashSuspectOpenRef = useRef<boolean | null>(null);
  const crashSuspectControlsRef = useRef<{ close: () => void } | null>(null);
  const suspendSuspectMessageRef = useRef<string | null>(null);
  const suspendSuspectOpenRef = useRef<boolean | null>(null);
  const suspendSuspectControlsRef = useRef<{ close: () => void } | null>(null);
  const controlsRef = useRef<{
    canStartOrResume: boolean;
    statusLabel: string;
    showResumeLabel?: boolean;
    startPending?: boolean;
    handleStartOrResume?: () => Promise<void>;
    handlePause?: () => void;
    stopRequested?: boolean;
  } | null>(null);
  const authRef = useRef<{
    authDialogOpen: boolean;
    closeAuthDialog: () => void;
    handleProviderSelect: (provider: AuthProviderType) => void;
  } | null>(null);

  const {
    stableHandleStartOrResume,
    stableHandlePause,
    stableCloseAuthDialog,
    stableHandleProviderSelect,
    stableCloseCrashSuspect,
    stableCloseSuspendSuspect,
  } = useShapeBuildStepAtomSyncCallbacks({
    handleStartOrResume,
    handlePause,
    closeAuthDialog,
    handleProviderSelect,
    setCrashSuspectOpenFromHook,
    setSuspendSuspectOpenFromHook,
  });

  useEffect(() => {
    if (stagesRef.current === stages) return;
    stagesRef.current = stages;
    setStages(stages);
  }, [setStages, stages]);

  useEffect(() => {
    if (stageProgressRef.current === stageProgress) return;
    stageProgressRef.current = stageProgress;
    setStageProgress(stageProgress);
  }, [setStageProgress, stageProgress]);

  useEffect(() => {
    const nextPane = paneProgress ?? [];
    if (paneProgressRef.current === nextPane) return;
    paneProgressRef.current = nextPane;
    setPaneProgress(nextPane);
  }, [setPaneProgress, paneProgress]);

  useEffect(() => {
    if (tasksByStageRef.current === tasksByStage) return;
    tasksByStageRef.current = tasksByStage;
    setTasksByStage(tasksByStage);
  }, [setTasksByStage, tasksByStage]);

  useEffect(() => {
    if (buildStatusRef.current === buildStatus) return;
    buildStatusRef.current = buildStatus;
    setBuildStatus(buildStatus);
  }, [buildStatus, setBuildStatus]);

  useShapeBuildStepAtomSyncAtomEffects({
    buildStatus,
    completed,
    failed,
    hasProgressData,
    stageTotals,
    overallProgress,
    skipped,
    stageLabel: stageLabel ?? '',
    taskLabel: taskLabel ?? '',
    total,
    taskUnitLabel: taskUnitLabel ?? '',
    totalElapsedMs: totalElapsedMs ?? 0,
    timingStageId: timingStageId ?? null,
    completedStageElapsedMs,
    stageElapsedMs: stageElapsedMs ?? 0,
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
  });

  useEffect(() => {
    const nextWarning = warningMessage ?? null;
    if (warningMessageRef.current === nextWarning) return;
    warningMessageRef.current = nextWarning;
    setWarningMessage(nextWarning);
  }, [setWarningMessage, warningMessage]);

  useEffect(() => {
    const nextMessage = crashSuspectMessage ?? null;
    if (crashSuspectMessageRef.current === nextMessage) return;
    crashSuspectMessageRef.current = nextMessage;
    setCrashSuspectMessage(nextMessage);
  }, [crashSuspectMessage, setCrashSuspectMessage]);

  useEffect(() => {
    if (crashSuspectOpenRef.current === crashSuspectOpen) return;
    crashSuspectOpenRef.current = crashSuspectOpen;
    setCrashSuspectOpen(crashSuspectOpen);
  }, [crashSuspectOpen, setCrashSuspectOpen]);

  useEffect(() => {
    const nextControls = { close: stableCloseCrashSuspect };
    if (crashSuspectControlsRef.current?.close === nextControls.close) return;
    crashSuspectControlsRef.current = nextControls;
    setCrashSuspectControls(nextControls);
  }, [setCrashSuspectControls, stableCloseCrashSuspect]);

  useEffect(() => {
    const nextMessage = suspendSuspectMessage ?? null;
    if (suspendSuspectMessageRef.current === nextMessage) return;
    suspendSuspectMessageRef.current = nextMessage;
    setSuspendSuspectMessage(nextMessage);
  }, [setSuspendSuspectMessage, suspendSuspectMessage]);

  useEffect(() => {
    if (suspendSuspectOpenRef.current === suspendSuspectOpen) return;
    suspendSuspectOpenRef.current = suspendSuspectOpen;
    setSuspendSuspectOpen(suspendSuspectOpen);
  }, [setSuspendSuspectOpen, suspendSuspectOpen]);

  useEffect(() => {
    const nextControls = { close: stableCloseSuspendSuspect };
    if (suspendSuspectControlsRef.current?.close === nextControls.close) return;
    suspendSuspectControlsRef.current = nextControls;
    setSuspendSuspectControls(nextControls);
  }, [setSuspendSuspectControls, stableCloseSuspendSuspect]);
};
