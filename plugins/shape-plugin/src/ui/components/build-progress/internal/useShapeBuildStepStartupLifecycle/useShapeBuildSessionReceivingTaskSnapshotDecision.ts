import { useEffect } from 'react';
import {
  resolveReceivingTaskSnapshotDecision,
  type ReceivingTaskSnapshotDecision,
  type ReceivingTaskSnapshotSuccessDecision,
} from '~/ui/components/build-progress/resolveReceivingTaskSnapshotDecision';
import type { BuildSessionTransitionNotificationLevel } from '@hierarchidb/components/build-session';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressTypes';
import type {
  BuildSessionTransitionPhase,
  BuildStartupStep,
  BuildStartupStepOutcome,
} from '../useShapeBuildStepHelpers/startupTrace';
import type {
  BuildSessionTransitionState,
} from '@hierarchidb/components/build-session';
import type { BuildStatusSource } from '~/ui/components/build-progress/resolveBuildStatusSource';
import { isShapeBuildPanelDebugEnabled } from '~/ui/components/build-progress/useBuildProgressPanelState/useBuildProgressPanelState.utils.js';

type UseShapeBuildSessionReceivingTaskSnapshotDecisionArgs = {
  activeNodeId: string | null;
  buildSessionTransition: BuildSessionTransitionState<BuildSessionTransitionPhase>;
  buildStatus: BuildStatusSource;
  displayTasks: ShapeBuildTaskSummary[];
  hasReceivingTaskSnapshotSignal: boolean;
  hasStartedTasks: boolean;
  hasProgressTaskSignal: boolean;
  isTaskSnapshotProgressConnected: boolean;
  sessionProgressTotal?: number;
  sessionStageId: string | null;
  receivingTaskSnapshotExpectationRef: { current: boolean };
  lastReceivingTaskSnapshotDecisionTraceKeyRef: { current: string | null };
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

type SuccessDecision = ReceivingTaskSnapshotSuccessDecision;
type ErrorDecision = Extract<ReceivingTaskSnapshotDecision, { kind: 'error' }>;
type CancelledDecision = Extract<ReceivingTaskSnapshotDecision, { kind: 'cancelled' }>;

const resolveDecisionInput = ({
  hasReceivingTaskSnapshotSignal,
  hasStartedTasks,
  hasProgressTaskSignal,
  buildStatus,
  isTaskSnapshotProgressConnected,
  receivingTaskSnapshotExpectationRef,
  sessionProgressTotal,
  sessionStageId,
  displayTasks,
}: {
  hasReceivingTaskSnapshotSignal: boolean;
  hasStartedTasks: boolean;
  hasProgressTaskSignal: boolean;
  buildStatus: BuildStatusSource;
  isTaskSnapshotProgressConnected: boolean;
  receivingTaskSnapshotExpectationRef: { current: boolean };
  sessionProgressTotal?: number;
  sessionStageId: string | null;
  displayTasks: ShapeBuildTaskSummary[];
}): Parameters<typeof resolveReceivingTaskSnapshotDecision>[0] => ({
  hasReceivingTaskSnapshotSignal,
  hasStartedTasks,
  hasProgressTaskSignal,
  buildStatus,
  taskCount: isTaskSnapshotProgressConnected ? displayTasks.length : undefined,
  isTaskSnapshotProgressConnected,
  expectTaskGeneration: receivingTaskSnapshotExpectationRef.current,
  sessionProgressTotal,
  sessionStageId,
});

const createDecisionTraceKey = (input: {
  phase: BuildSessionTransitionPhase;
  buildStatus: BuildStatusSource;
  hasReceivingTaskSnapshotSignal: boolean;
  hasStartedTasks: boolean;
  hasProgressTaskSignal: boolean;
  taskCount: number | undefined;
  isTaskSnapshotProgressConnected: boolean;
  expectTaskGeneration: boolean;
  sessionProgressTotal: number | undefined;
  sessionStageId: string | null;
}): string | null => {
  if (!isShapeBuildPanelDebugEnabled('receivingTaskSnapshotDecision')) return null;
  return JSON.stringify({
    phase: input.phase,
    buildStatus: input.buildStatus,
    hasReceivingTaskSnapshotSignal: input.hasReceivingTaskSnapshotSignal,
    hasStartedTasks: input.hasStartedTasks,
    hasProgressTaskSignal: input.hasProgressTaskSignal,
    taskCount: input.taskCount,
    isTaskSnapshotProgressConnected: input.isTaskSnapshotProgressConnected,
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
  emitBuildSessionTransitionLog: UseShapeBuildSessionReceivingTaskSnapshotDecisionArgs['emitBuildSessionTransitionLog'];
  pushBuildSessionTransitionNotification: UseShapeBuildSessionReceivingTaskSnapshotDecisionArgs['pushBuildSessionTransitionNotification'];
  finishBuildStartupStep: UseShapeBuildSessionReceivingTaskSnapshotDecisionArgs['finishBuildStartupStep'];
  finishBuildSessionTransition: UseShapeBuildSessionReceivingTaskSnapshotDecisionArgs['finishBuildSessionTransition'];
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
  finishBuildStartupStep('receiving-task-snapshot', 'success', {
    reason: decision.reason,
    tasks: displayTasks.length,
    hasProgressTaskSignal,
  });
  if (decision.transitionFinish) {
    finishBuildSessionTransition(decision.transitionFinish);
  } else {
    finishBuildSessionTransition();
  }
  if (isShapeBuildPanelDebugEnabled('receivingTaskSnapshotDecision')) {
    console.log(
      '[ShapeReceivingTaskSnapshotDecisionTrace] decision',
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
  finishBuildStartupStep: UseShapeBuildSessionReceivingTaskSnapshotDecisionArgs['finishBuildStartupStep'];
  finishBuildSessionTransition: UseShapeBuildSessionReceivingTaskSnapshotDecisionArgs['finishBuildSessionTransition'];
}): void => {
  finishBuildStartupStep('receiving-task-snapshot', 'error', {
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
  finishBuildStartupStep: UseShapeBuildSessionReceivingTaskSnapshotDecisionArgs['finishBuildStartupStep'];
  finishBuildSessionTransition: UseShapeBuildSessionReceivingTaskSnapshotDecisionArgs['finishBuildSessionTransition'];
}): void => {
  finishBuildStartupStep('receiving-task-snapshot', 'cancelled', {
    reason: decision.reason,
  });
  finishBuildSessionTransition(decision.transitionFinish);
};

export const useShapeBuildSessionReceivingTaskSnapshotDecision = ({
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
}: UseShapeBuildSessionReceivingTaskSnapshotDecisionArgs): void => {
  useEffect(() => {
    if (!buildSessionTransition.active) return;
    if (buildSessionTransition.phase !== 'receiving-task-snapshot') return;

    const decisionInput = resolveDecisionInput({
      hasReceivingTaskSnapshotSignal,
      hasStartedTasks,
      hasProgressTaskSignal,
      buildStatus,
      isTaskSnapshotProgressConnected,
      receivingTaskSnapshotExpectationRef,
      sessionProgressTotal,
      sessionStageId,
      displayTasks,
    });
    const decisionTraceKey = createDecisionTraceKey({
      phase: buildSessionTransition.phase,
      buildStatus,
      hasReceivingTaskSnapshotSignal: decisionInput.hasReceivingTaskSnapshotSignal,
      hasStartedTasks: decisionInput.hasStartedTasks,
      hasProgressTaskSignal: decisionInput.hasProgressTaskSignal,
      taskCount: decisionInput.taskCount,
      isTaskSnapshotProgressConnected: decisionInput.isTaskSnapshotProgressConnected,
      expectTaskGeneration: decisionInput.expectTaskGeneration,
      sessionProgressTotal: decisionInput.sessionProgressTotal,
      sessionStageId,
    });
    if (
      decisionTraceKey
      && isShapeBuildPanelDebugEnabled('receivingTaskSnapshotDecision')
      && lastReceivingTaskSnapshotDecisionTraceKeyRef.current !== decisionTraceKey
    ) {
      lastReceivingTaskSnapshotDecisionTraceKeyRef.current = decisionTraceKey;
      console.log('[ShapeReceivingTaskSnapshotDecisionTrace] input', JSON.stringify({
        nodeId: activeNodeId,
        ...decisionInput,
      }));
    }

    const decision = resolveReceivingTaskSnapshotDecision(decisionInput);
    if (isShapeBuildPanelDebugEnabled('receivingTaskSnapshotDecision') && decision.kind !== 'continue') {
      console.log('[ShapeReceivingTaskSnapshotDecisionTrace] decision', JSON.stringify({
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
    displayTasks,
    hasReceivingTaskSnapshotSignal,
    hasProgressTaskSignal,
    hasStartedTasks,
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
  ]);
};
