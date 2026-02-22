import { useState } from 'react';
import { useShapeBuildSessionStartupTrace } from './useShapeBuildStepStartupLifecycle/useShapeBuildSessionStartupTrace';
import { useShapeBuildSessionStartupProgressTerminalLog } from './useShapeBuildStepStartupLifecycle/useShapeBuildSessionStartupProgressTerminalLog';
import { useShapeBuildSessionStartupTransitionTimers } from './useShapeBuildStepStartupLifecycle/useShapeBuildSessionStartupTransitionTimers';
import { useShapeBuildSessionAwaitingFirstTaskDecision } from './useShapeBuildStepStartupLifecycle/useShapeBuildSessionAwaitingFirstTaskDecision';
import type {
  BuildSessionTransitionNotificationLevel,
  BuildSessionTransitionState,
} from '@hierarchidb/components/build-session';
import type { BuildProgress } from '~/ui/components/build-progress/shapeBuildProgressMapping';
import type { BuildProgressStatus } from '~/ui/components/build-progress/shapeBuildProgressMapping';
import type { BuildStatusSource } from '~/ui/components/build-progress/resolveBuildStatusSource';
import type {
  BuildSessionTransitionPhase,
  BuildStartupStep,
  BuildStartupStepOutcome,
} from './useShapeBuildStepHelpers/startupTrace';
import { UI_POLL_INTERVAL_MS } from './useShapeBuildStepHelpers/constants';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';

type UseShapeBuildSessionStartupLifecycleArgs = {
  activeNodeId: string | null;
  buildSessionTransition: BuildSessionTransitionState<BuildSessionTransitionPhase>;
  buildStatus: BuildStatusSource;
  resolveTaskType: string | null;
  effectiveProgress: BuildProgress | null;
  displayTasks: ShapeBuildTaskSummary[];
  hasFirstTaskSignal: boolean;
  hasStartedTasks: boolean;
  hasProgressTaskSignal: boolean;
  isTaskStreamReady: boolean;
  runtimeStatus: BuildProgressStatus['status'];
  sessionProgressTotal?: number;
  sessionStageId: string | null;
  awaitingFirstTaskExpectationRef: { current: boolean };
  resolvedTaskType: string | undefined;
  lastAwaitingFirstTaskDecisionTraceKeyRef: { current: string | null };
  buildSessionTransitionTaskStartNotifiedRef: { current: boolean };
  progressTerminalLogKeyRef: { current: string | null };
  buildSessionTransitionWarnStepRef: { current: 0 | 1 | 2 | 3 };
  buildSessionTransitionWaitLogStepRef: { current: number };
  emitBuildSessionTransitionLog: (
    level: 'info' | 'warn' | 'error',
    message: string,
    payload?: Record<string, unknown>,
  ) => void;
  pushBuildSessionTransitionNotification: (
    level: BuildSessionTransitionNotificationLevel,
    message: string,
  ) => void;
  finishBuildStartupStep: (
    step: BuildStartupStep,
    outcome: BuildStartupStepOutcome,
    extra?: Record<string, unknown>,
  ) => void;
  finishBuildSessionTransition: (options?: {
    message?: string;
    level?: BuildSessionTransitionNotificationLevel;
  }) => void;
};

export const useShapeBuildSessionStartupLifecycle = ({
  activeNodeId,
  buildSessionTransition,
  buildStatus,
  resolveTaskType,
  effectiveProgress,
  displayTasks,
  hasFirstTaskSignal,
  hasStartedTasks,
  hasProgressTaskSignal,
  isTaskStreamReady,
  runtimeStatus,
  sessionProgressTotal,
  sessionStageId,
  awaitingFirstTaskExpectationRef,
  resolvedTaskType,
  lastAwaitingFirstTaskDecisionTraceKeyRef,
  buildSessionTransitionTaskStartNotifiedRef,
  progressTerminalLogKeyRef,
  buildSessionTransitionWarnStepRef,
  buildSessionTransitionWaitLogStepRef,
  emitBuildSessionTransitionLog,
  pushBuildSessionTransitionNotification,
  finishBuildStartupStep,
  finishBuildSessionTransition,
}: UseShapeBuildSessionStartupLifecycleArgs) => {
  const [buildSessionTransitionElapsedMs, setBuildSessionTransitionElapsedMs] = useState(0);

  useShapeBuildSessionStartupTrace({
    activeNodeId,
    buildStatus,
    effectiveProgress,
    resolveTaskType,
  });

  useShapeBuildSessionStartupProgressTerminalLog({
    buildStatus,
    effectiveProgress,
    runtimeStatus,
    resolvedTaskType,
    progressTerminalLogKeyRef,
    emitBuildSessionTransitionLog,
    buildSessionTransition,
  });

  useShapeBuildSessionStartupTransitionTimers({
    buildSessionTransition,
    setBuildSessionTransitionElapsedMs,
    buildSessionTransitionWarnStepRef,
    buildSessionTransitionWaitLogStepRef,
    emitBuildSessionTransitionLog,
    pushBuildSessionTransitionNotification,
    finishBuildStartupStep,
    finishBuildSessionTransition,
  });

  useShapeBuildSessionAwaitingFirstTaskDecision({
    activeNodeId,
    buildSessionTransition,
    buildStatus,
    displayTasks,
    hasFirstTaskSignal,
    hasStartedTasks,
    hasProgressTaskSignal,
    isTaskStreamReady,
    sessionProgressTotal,
    sessionStageId,
    awaitingFirstTaskExpectationRef,
    lastAwaitingFirstTaskDecisionTraceKeyRef,
    buildSessionTransitionTaskStartNotifiedRef,
    emitBuildSessionTransitionLog,
    pushBuildSessionTransitionNotification,
    finishBuildStartupStep,
    finishBuildSessionTransition,
  });

  return {
    buildSessionTransitionElapsedMs,
    pollIntervalMs: UI_POLL_INTERVAL_MS,
  };
};
