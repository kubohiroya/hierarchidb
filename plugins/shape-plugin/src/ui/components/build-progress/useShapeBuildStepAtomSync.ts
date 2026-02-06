import { useCallback, useEffect, useRef } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import { useSetAtom } from 'jotai';
import {
  taskStatusAtom,
  type TaskProgressControls,
  type TaskProgressAuthState,
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
} from '../../atoms/shapeBuildProgressAtoms.ts';
import type { ShapeDialogStepProps } from '../ShapeDialogStepProps.tsx';
import { useShapeBuildStep } from './useShapeBuildStep.ts';
import type { AuthProviderType } from '@hierarchidb/ui-auth';

function shallowEqualObject<T extends Record<string, unknown> | null | undefined>(
  a: T,
  b: T,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => (a as Record<string, unknown>)[key] === (b as Record<string, unknown>)[key]);
}

const buildStagesSignature = (stages: Array<{ id?: string; title?: string; description?: string }>): string => (
  stages
    .map((stage) => `${stage.id ?? ''}:${stage.title ?? ''}:${stage.description ?? ''}`)
    .join('||')
);

const buildStageProgressSignature = (stageProgress: Record<string, number>): string => (
  Object.keys(stageProgress)
    .sort()
    .map((key) => `${key}=${stageProgress[key] ?? 0}`)
    .join('|')
);

const buildPaneProgressSignature = (
  paneProgress: Array<{ paneId?: string; progress?: number; taskCount?: number; completedCount?: number; status?: string }>,
): string => (
  paneProgress
    .map((pane) => `${pane.paneId ?? ''}:${pane.progress ?? 0}:${pane.taskCount ?? 0}:${pane.completedCount ?? 0}:${pane.status ?? ''}`)
    .join('|')
);

const buildTasksSignature = (tasksByStage: Record<string, { taskId?: string; status?: string; message?: string }[]>): string => {
  const stageKeys = Object.keys(tasksByStage).sort();
  return stageKeys
    .map((stageKey) => {
      const tasks = tasksByStage[stageKey] ?? [];
      const taskKey = tasks
        .map((task) => `${task.taskId ?? ''}:${task.status ?? ''}:${task.message ?? ''}`)
        .join('|');
      return `${stageKey}=${taskKey}`;
    })
    .join('||');
};

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
    handleStartOrResume,
    handlePause,
    isPausePending,
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

  const stagesRef = useRef<{ value: typeof stages | null; signature: string | null }>({ value: null, signature: null });
  const stageProgressRef = useRef<{ value: typeof stageProgress | null; signature: string | null }>({ value: null, signature: null });
  const paneProgressRef = useRef<{ value: typeof paneProgress | null; signature: string | null }>({ value: null, signature: null });
  const tasksByStageRef = useRef<{ value: typeof tasksByStage | null; signature: string | null }>({ value: null, signature: null });
  const buildStatusRef = useRef<typeof buildStatus | null>(null);
  const summaryRef = useRef<{
    stageLabel: typeof stageLabel;
    taskLabel: typeof taskLabel;
    taskUnitLabel: typeof taskUnitLabel;
    overallProgress: typeof overallProgress;
    completed: typeof completed;
    total: typeof total;
    failed: typeof failed;
    skipped: typeof skipped;
    buildStatus: typeof buildStatus;
    hasProgressData: typeof hasProgressData;
    totalElapsedMs: typeof totalElapsedMs;
    stageElapsedMs: typeof stageElapsedMs;
    stageRemainingMs: typeof stageRemainingMs;
  } | null>(null);
  const taskSummaryLoadingRef = useRef<boolean | null>(null);
  const warningMessageRef = useRef<string | null>(null);
  const crashSuspectMessageRef = useRef<string | null>(null);
  const crashSuspectOpenRef = useRef<boolean | null>(null);
  const crashSuspectControlsRef = useRef<{ close: () => void } | null>(null);
  const suspendSuspectMessageRef = useRef<string | null>(null);
  const suspendSuspectOpenRef = useRef<boolean | null>(null);
  const suspendSuspectControlsRef = useRef<{ close: () => void } | null>(null);
  const controlsRef = useRef<TaskProgressControls | null>(null);
  const authRef = useRef<TaskProgressAuthState | null>(null);

  const handleStartOrResumeRef = useRef<(() => Promise<void>) | null>(null);
  const handlePauseRef = useRef<(() => void | Promise<void>) | null>(null);
  const closeAuthDialogRef = useRef<(() => void) | null>(null);
  const handleProviderSelectRef = useRef<((provider: AuthProviderType) => void) | null>(null);

  const stableHandleStartOrResume = useCallback(() => {
    return handleStartOrResumeRef.current ? handleStartOrResumeRef.current() : Promise.resolve();
  }, []);
  const stableHandlePause = useCallback(() => {
    void handlePauseRef.current?.();
  }, []);
  const stableCloseAuthDialog = useCallback(() => {
    closeAuthDialogRef.current?.();
  }, []);
  const stableHandleProviderSelect = useCallback((provider: AuthProviderType) => {
    handleProviderSelectRef.current?.(provider);
  }, []);
  const stableCloseCrashSuspect = useCallback(() => {
    setCrashSuspectOpenFromHook();
  }, [setCrashSuspectOpenFromHook]);
  const stableCloseSuspendSuspect = useCallback(() => {
    setSuspendSuspectOpenFromHook();
  }, [setSuspendSuspectOpenFromHook]);

  useEffect(() => {
    handleStartOrResumeRef.current = handleStartOrResume ?? null;
    handlePauseRef.current = handlePause ?? null;
    closeAuthDialogRef.current = closeAuthDialog ?? null;
    handleProviderSelectRef.current = handleProviderSelect ?? null;
  }, [handleStartOrResume, handlePause, closeAuthDialog, handleProviderSelect]);

  useEffect(() => {
    const nextSignature = buildStagesSignature(stages);
    if (stagesRef.current.signature === nextSignature) return;
    stagesRef.current = { value: stages, signature: nextSignature };
    setStages(stages);
  }, [setStages, stages]);

  useEffect(() => {
    const nextSignature = buildStageProgressSignature(stageProgress);
    if (stageProgressRef.current.signature === nextSignature) return;
    stageProgressRef.current = { value: stageProgress, signature: nextSignature };
    setStageProgress(stageProgress);
  }, [setStageProgress, stageProgress]);

  useEffect(() => {
    const nextPane = paneProgress ?? [];
    const nextSignature = buildPaneProgressSignature(nextPane);
    if (paneProgressRef.current.signature === nextSignature) return;
    paneProgressRef.current = { value: nextPane, signature: nextSignature };
    setPaneProgress(nextPane);
  }, [setPaneProgress, paneProgress]);

  useEffect(() => {
    const nextSignature = buildTasksSignature(tasksByStage);
    if (tasksByStageRef.current.value && tasksByStageRef.current.signature === nextSignature) {
      return;
    }
    tasksByStageRef.current = { value: tasksByStage, signature: nextSignature };
    setTasksByStage(tasksByStage);
  }, [setTasksByStage, tasksByStage]);

  useEffect(() => {
    if (buildStatusRef.current === buildStatus) return;
    buildStatusRef.current = buildStatus;
    setBuildStatus(buildStatus);
  }, [buildStatus, setBuildStatus]);

  useEffect(() => {
    const nextSummary = {
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
      totalElapsedMs,
      stageElapsedMs,
      stageRemainingMs,
    };
    if (shallowEqualObject(summaryRef.current, nextSummary)) return;
    summaryRef.current = nextSummary;
    setSummary(nextSummary);
  }, [
    buildStatus,
    completed,
    failed,
    hasProgressData,
    overallProgress,
    skipped,
    stageLabel,
    taskLabel,
    total,
    setSummary,
    taskUnitLabel,
    totalElapsedMs,
    stageElapsedMs,
    stageRemainingMs,
  ]);

  useEffect(() => {
    if (taskSummaryLoadingRef.current === isTaskSummaryLoading) return;
    taskSummaryLoadingRef.current = isTaskSummaryLoading;
    setTaskSummaryLoading(isTaskSummaryLoading);
  }, [isTaskSummaryLoading, setTaskSummaryLoading]);

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

  useEffect(() => {
    const nextControls = {
      canStartOrResume,
      statusLabel: statusLabel ?? '',
      handleStartOrResume: stableHandleStartOrResume,
      handlePause: stableHandlePause,
      pausePending: Boolean(isPausePending),
    };
    if (shallowEqualObject(controlsRef.current, nextControls)) return;
    controlsRef.current = nextControls;
    setControls(nextControls);
  }, [
    canStartOrResume,
    isPausePending,
    setControls,
    statusLabel,
    stableHandlePause,
    stableHandleStartOrResume,
  ]);

  useEffect(() => {
    const nextAuth = {
      authDialogOpen: Boolean(authDialogOpen),
      closeAuthDialog: stableCloseAuthDialog,
      handleProviderSelect: stableHandleProviderSelect,
    };
    if (shallowEqualObject(authRef.current, nextAuth)) return;
    authRef.current = nextAuth;
    setAuth(nextAuth);
  }, [authDialogOpen, setAuth, stableCloseAuthDialog, stableHandleProviderSelect]);
};
