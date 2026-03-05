import { useState } from 'react';
import { useShapeBuildSessionStartupTrace } from './useShapeBuildStepStartupLifecycle/useShapeBuildSessionStartupTrace';
import { useShapeBuildSessionStartupProgressTerminalLog } from './useShapeBuildStepStartupLifecycle/useShapeBuildSessionStartupProgressTerminalLog';
import { useShapeBuildSessionStartupTransitionTimers } from './useShapeBuildStepStartupLifecycle/useShapeBuildSessionStartupTransitionTimers';
import { useShapeBuildSessionReceivingTaskSnapshotDecision } from './useShapeBuildStepStartupLifecycle/useShapeBuildSessionReceivingTaskSnapshotDecision';
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

const POLL_INTERVAL_MS = 1000;
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressTypes';

type UseShapeBuildSessionStartupLifecycleArgs = {
  activeNodeId: string | null;
  buildSessionTransition: BuildSessionTransitionState<BuildSessionTransitionPhase>;
  buildStatus: BuildStatusSource;
  resolveStage: string | null;
  effectiveProgress: BuildProgress | null;
  displayTasks: ShapeBuildTaskSummary[];
  hasReceivingTaskSnapshotSignal: boolean;
  hasStartedTasks: boolean;
  hasProgressTaskSignal: boolean;
  isTaskSnapshotProgressConnected: boolean;
  runtimeStatus: BuildProgressStatus['status'];
  sessionProgressTotal?: number;
  sessionStageId: string | null;
  receivingTaskSnapshotExpectationRef: { current: boolean };
  resolvedStage: string | undefined;
  lastReceivingTaskSnapshotDecisionTraceKeyRef: { current: string | null };
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
  resolveStage,
  effectiveProgress,
  displayTasks,
  hasReceivingTaskSnapshotSignal,
  hasStartedTasks,
  hasProgressTaskSignal,
  isTaskSnapshotProgressConnected,
  runtimeStatus,
  sessionProgressTotal,
  sessionStageId,
  receivingTaskSnapshotExpectationRef,
  resolvedStage,
  lastReceivingTaskSnapshotDecisionTraceKeyRef,
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
    resolveStage,
  });

  useShapeBuildSessionStartupProgressTerminalLog({
    buildStatus,
    effectiveProgress,
    runtimeStatus,
    resolvedStage,
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

  useShapeBuildSessionReceivingTaskSnapshotDecision({
    activeNodeId,
    buildSessionTransition,
    buildStatus,
    displayTasks,
    hasReceivingTaskSnapshotSignal,
    hasStartedTasks,
    hasProgressTaskSignal,
    isTaskSnapshotProgressConnected,
    sessionProgressTotal,
    sessionStageId,
    receivingTaskSnapshotExpectationRef,
    lastReceivingTaskSnapshotDecisionTraceKeyRef,
    buildSessionTransitionTaskStartNotifiedRef,
    emitBuildSessionTransitionLog,
    pushBuildSessionTransitionNotification,
    finishBuildStartupStep,
    finishBuildSessionTransition,
  });

  return {
    buildSessionTransitionElapsedMs,
    pollIntervalMs: POLL_INTERVAL_MS,
  };
};
