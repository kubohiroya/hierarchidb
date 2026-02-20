import { useEffect } from 'react';
import {
  resolveAwaitingFirstTaskDecision,
  type AwaitingFirstTaskDecision,
  type AwaitingFirstTaskSuccessDecision,
} from '~/ui/components/build-progress/resolveAwaitingFirstTaskDecision';
import type { BuildSessionTransitionNotificationLevel } from '@hierarchidb/components/build-session';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';
import type {
  BuildSessionTransitionPhase,
  BuildStartupStep,
  BuildStartupStepOutcome,
} from '../useShapeBuildStepHelpers/startupTrace';
import type {
  BuildSessionTransitionState,
} from '@hierarchidb/components/build-session';
import type { BuildStatusSource } from '~/ui/components/build-progress/resolveBuildStatusSource';

type UseShapeBuildSessionAwaitingFirstTaskDecisionArgs = {
  activeNodeId: string | null;
  buildSessionTransition: BuildSessionTransitionState<BuildSessionTransitionPhase>;
  buildStatus: BuildStatusSource;
  displayTasks: ShapeBuildTaskSummary[];
  hasFirstTaskSignal: boolean;
  hasStartedTasks: boolean;
  hasProgressTaskSignal: boolean;
  isTaskStreamReady: boolean;
  sessionProgressTotal?: number;
  sessionStageId: string | null;
  awaitingFirstTaskExpectationRef: { current: boolean };
  lastAwaitingFirstTaskDecisionTraceKeyRef: { current: string | null };
  buildSessionTransitionTaskStartNotifiedRef: { current: boolean };
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

type SuccessDecision = AwaitingFirstTaskSuccessDecision;
type ErrorDecision = Extract<AwaitingFirstTaskDecision, { kind: 'error' }>;
type CancelledDecision = Extract<AwaitingFirstTaskDecision, { kind: 'cancelled' }>;

const resolveDecisionInput = ({
  hasFirstTaskSignal,
  hasStartedTasks,
  hasProgressTaskSignal,
  buildStatus,
  isTaskStreamReady,
  awaitingFirstTaskExpectationRef,
  sessionProgressTotal,
  sessionStageId,
  displayTasks,
}: {
  hasFirstTaskSignal: boolean;
  hasStartedTasks: boolean;
  hasProgressTaskSignal: boolean;
  buildStatus: BuildStatusSource;
  isTaskStreamReady: boolean;
  awaitingFirstTaskExpectationRef: { current: boolean };
  sessionProgressTotal?: number;
  sessionStageId: string | null;
  displayTasks: ShapeBuildTaskSummary[];
}): Parameters<typeof resolveAwaitingFirstTaskDecision>[0] => ({
  hasFirstTaskSignal,
  hasStartedTasks,
  hasProgressTaskSignal,
  buildStatus,
  taskCount: isTaskStreamReady ? displayTasks.length : undefined,
  isTaskStreamReady,
  expectTaskGeneration: awaitingFirstTaskExpectationRef.current,
  sessionProgressTotal,
  sessionStageId,
});

const createDecisionTraceKey = (input: {
  phase: BuildSessionTransitionPhase;
  buildStatus: BuildStatusSource;
  hasFirstTaskSignal: boolean;
  hasStartedTasks: boolean;
  hasProgressTaskSignal: boolean;
  taskCount: number | undefined;
  isTaskStreamReady: boolean;
  expectTaskGeneration: boolean;
  sessionProgressTotal: number | undefined;
  sessionStageId: string | null;
}): string | null => {
  if (!import.meta.env.DEV) return null;
  return JSON.stringify({
    phase: input.phase,
    buildStatus: input.buildStatus,
    hasFirstTaskSignal: input.hasFirstTaskSignal,
    hasStartedTasks: input.hasStartedTasks,
    hasProgressTaskSignal: input.hasProgressTaskSignal,
    taskCount: input.taskCount,
    isTaskStreamReady: input.isTaskStreamReady,
    expectTaskGeneration: input.expectTaskGeneration,
    sessionProgressTotal: input.sessionProgressTotal ?? null,
    sessionStageId: input.sessionStageId ?? null,
  });
};

const handleDecisionSuccess = ({
  decision,
  displayTasks,
  hasProgressTaskSignal,
  activeNodeId,
  buildSessionTransitionTaskStartNotifiedRef,
  emitBuildSessionTransitionLog,
  pushBuildSessionTransitionNotification,
  finishBuildStartupStep,
  finishBuildSessionTransition,
}: {
  decision: SuccessDecision;
  displayTasks: ShapeBuildTaskSummary[];
  hasProgressTaskSignal: boolean;
  activeNodeId: string | null;
  buildSessionTransitionTaskStartNotifiedRef: { current: boolean };
  emitBuildSessionTransitionLog: UseShapeBuildSessionAwaitingFirstTaskDecisionArgs['emitBuildSessionTransitionLog'];
  pushBuildSessionTransitionNotification: UseShapeBuildSessionAwaitingFirstTaskDecisionArgs['pushBuildSessionTransitionNotification'];
  finishBuildStartupStep: UseShapeBuildSessionAwaitingFirstTaskDecisionArgs['finishBuildStartupStep'];
  finishBuildSessionTransition: UseShapeBuildSessionAwaitingFirstTaskDecisionArgs['finishBuildSessionTransition'];
}): void => {
  if (!buildSessionTransitionTaskStartNotifiedRef.current) {
    buildSessionTransitionTaskStartNotifiedRef.current = true;
    emitBuildSessionTransitionLog('info', 'task execution started', {
      tasks: displayTasks.length,
      queuedOnly: decision.taskExecutionStarted.queuedOnly,
      hasProgressTaskSignal: decision.taskExecutionStarted.hasProgressTaskSignal,
    });
    pushBuildSessionTransitionNotification(
      decision.notification.level,
      decision.notification.message,
    );
  }
  finishBuildStartupStep('awaiting-first-task', 'success', {
    reason: decision.reason,
    tasks: displayTasks.length,
    hasProgressTaskSignal,
  });
  if (decision.transitionFinish) {
    finishBuildSessionTransition(decision.transitionFinish);
  } else {
    finishBuildSessionTransition();
  }
  if (import.meta.env.DEV) {
    console.log(
      '[ShapeAwaitingFirstTaskDecisionTrace] decision',
      JSON.stringify({
        nodeId: activeNodeId,
        decision,
      }),
    );
  }
};

const handleDecisionFailure = ({
  decision,
  finishBuildStartupStep,
  finishBuildSessionTransition,
}: {
  decision: ErrorDecision;
  finishBuildStartupStep: UseShapeBuildSessionAwaitingFirstTaskDecisionArgs['finishBuildStartupStep'];
  finishBuildSessionTransition: UseShapeBuildSessionAwaitingFirstTaskDecisionArgs['finishBuildSessionTransition'];
}): void => {
  finishBuildStartupStep('awaiting-first-task', 'error', {
    reason: decision.reason,
  });
  finishBuildSessionTransition(decision.transitionFinish);
};

const handleDecisionCancelled = ({
  decision,
  finishBuildStartupStep,
  finishBuildSessionTransition,
}: {
  decision: CancelledDecision;
  finishBuildStartupStep: UseShapeBuildSessionAwaitingFirstTaskDecisionArgs['finishBuildStartupStep'];
  finishBuildSessionTransition: UseShapeBuildSessionAwaitingFirstTaskDecisionArgs['finishBuildSessionTransition'];
}): void => {
  finishBuildStartupStep('awaiting-first-task', 'cancelled', {
    reason: decision.reason,
  });
  finishBuildSessionTransition(decision.transitionFinish);
};

export const useShapeBuildSessionAwaitingFirstTaskDecision = ({
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
}: UseShapeBuildSessionAwaitingFirstTaskDecisionArgs): void => {
  useEffect(() => {
    if (!buildSessionTransition.active) return;
    if (buildSessionTransition.phase !== 'awaiting-first-task') return;

    const decisionInput = resolveDecisionInput({
      hasFirstTaskSignal,
      hasStartedTasks,
      hasProgressTaskSignal,
      buildStatus,
      isTaskStreamReady,
      awaitingFirstTaskExpectationRef,
      sessionProgressTotal,
      sessionStageId,
      displayTasks,
    });
    const decisionTraceKey = createDecisionTraceKey({
      phase: buildSessionTransition.phase,
      buildStatus,
      hasFirstTaskSignal: decisionInput.hasFirstTaskSignal,
      hasStartedTasks: decisionInput.hasStartedTasks,
      hasProgressTaskSignal: decisionInput.hasProgressTaskSignal,
      taskCount: decisionInput.taskCount,
      isTaskStreamReady: decisionInput.isTaskStreamReady,
      expectTaskGeneration: decisionInput.expectTaskGeneration,
      sessionProgressTotal: decisionInput.sessionProgressTotal,
      sessionStageId,
    });
    if (decisionTraceKey && lastAwaitingFirstTaskDecisionTraceKeyRef.current !== decisionTraceKey) {
      lastAwaitingFirstTaskDecisionTraceKeyRef.current = decisionTraceKey;
      console.log('[ShapeAwaitingFirstTaskDecisionTrace] input', JSON.stringify({
        nodeId: activeNodeId,
        ...decisionInput,
      }));
    }

    const decision = resolveAwaitingFirstTaskDecision(decisionInput);
    if (import.meta.env.DEV && decision.kind !== 'continue') {
      console.log('[ShapeAwaitingFirstTaskDecisionTrace] decision', JSON.stringify({
        nodeId: activeNodeId,
        decision,
      }));
    }
    if (decision.kind === 'continue') return;
    switch (decision.kind) {
    case 'success': {
      handleDecisionSuccess({
        decision,
        displayTasks,
        hasProgressTaskSignal,
        activeNodeId,
        buildSessionTransitionTaskStartNotifiedRef,
        emitBuildSessionTransitionLog,
        pushBuildSessionTransitionNotification,
        finishBuildStartupStep,
        finishBuildSessionTransition,
      });
      return;
    }
    case 'error': {
      handleDecisionFailure({
        decision,
        finishBuildStartupStep,
        finishBuildSessionTransition,
      });
      return;
    }
    case 'cancelled': {
      handleDecisionCancelled({
        decision,
        finishBuildStartupStep,
        finishBuildSessionTransition,
      });
      return;
    }
      default:
        return;
    }
  }, [
    activeNodeId,
    buildSessionTransition,
    buildStatus,
    displayTasks.length,
    hasFirstTaskSignal,
    hasProgressTaskSignal,
    hasStartedTasks,
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
  ]);
};
