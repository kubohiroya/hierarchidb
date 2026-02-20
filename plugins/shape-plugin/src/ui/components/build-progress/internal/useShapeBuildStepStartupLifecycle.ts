import { useEffect, useState } from 'react';
import type { BuildStatus } from '@hierarchidb/components/build-status';
import type {
  BuildSessionTransitionNotificationLevel,
  BuildSessionTransitionState,
} from '@hierarchidb/components/build-session';
import type { BuildProgressStatus } from '~/ui/components/build-progress/shapeBuildProgressMapping';
import type { BuildProgress } from '~/ui/components/build-progress/shapeBuildProgressMapping';
import { isTaskPhaseDisplay } from '~/common/utils/taskMessages';
import { resolveAwaitingFirstTaskDecision } from '~/ui/components/build-progress/resolveAwaitingFirstTaskDecision';
import { resolveStartupTransitionWatchdogEvent } from '~/ui/components/build-progress/resolveStartupTransitionWatchdogEvent';
import { UI_POLL_INTERVAL_MS } from './useShapeBuildStepHelpers/constants';
import { emitShapeProgressStepTrace, isShapeProgressStepDebugEnabled } from './useShapeBuildStepHelpers/debug';
import type {
  BuildSessionTransitionPhase,
  BuildStartupStep,
  BuildStartupStepOutcome,
  ShapeProgressStepTracePayload,
} from './useShapeBuildStepHelpers/startupTrace';
import type { ShapeBuildTaskSummary } from '~/ui/atoms/shapeBuildProgressAtoms';

type UseShapeBuildSessionStartupLifecycleArgs = {
  activeNodeId: string | null;
  buildSessionTransition: BuildSessionTransitionState<BuildSessionTransitionPhase>;
  buildStatus: BuildStatus;
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
  completedTaskSequenceById: Map<string, number>;
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
  completedTaskSequenceById,
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

  useEffect(() => {
    if (!isShapeProgressStepDebugEnabled()) return;
    const nextTrace: ShapeProgressStepTracePayload = {
      nodeId: activeNodeId,
      phase: buildStatus,
      progressTaskId: effectiveProgress?.progressTaskId ?? null,
      progressTaskStatus: effectiveProgress?.progressTaskStatus ?? null,
      progressTaskStage: resolveTaskType,
      progressTaskProgress: effectiveProgress?.progressTaskProgress ?? null,
      percentage: effectiveProgress?.percentage ?? null,
      total: effectiveProgress?.total ?? 0,
      completed: effectiveProgress?.completed ?? 0,
      failed: effectiveProgress?.failed ?? 0,
      skipped: effectiveProgress?.skipped ?? 0,
      message: effectiveProgress?.message ?? null,
    };
    emitShapeProgressStepTrace(nextTrace);
  }, [activeNodeId, buildStatus, effectiveProgress, resolveTaskType, emitShapeProgressStepTrace]);

  useEffect(() => {
    if (!buildSessionTransition.active) {
      setBuildSessionTransitionElapsedMs(0);
      return;
    }
    const intervalId = window.setInterval(() => {
      const elapsedMs = Date.now() - buildSessionTransition.startedAt;
      setBuildSessionTransitionElapsedMs(elapsedMs);
      const watchdogEvent = resolveStartupTransitionWatchdogEvent({
        elapsedMs,
        warnStep: buildSessionTransitionWarnStepRef.current,
      });
      if (watchdogEvent.kind === 'none') return;
      buildSessionTransitionWarnStepRef.current = watchdogEvent.nextWarnStep;
      if (watchdogEvent.kind === 'timeout') {
        emitBuildSessionTransitionLog('error', 'build session transition timeout', {
          phase: buildSessionTransition.phase,
          elapsedMs,
        });
        if (buildSessionTransition.phase === 'awaiting-first-task') {
          finishBuildStartupStep('awaiting-first-task', 'error', {
            reason: 'timeout-before-task-start',
            elapsedMs,
          });
        }
        finishBuildSessionTransition({
          level: 'error',
          message: `Build did not start task processing (${buildSessionTransition.phase}, ${Math.round(elapsedMs / 1000)}s).`,
        });
        return;
      }
      if (watchdogEvent.kind === 'long-wait') {
        emitBuildSessionTransitionLog('warn', 'build session transition long wait', {
          phase: buildSessionTransition.phase,
          elapsedMs,
        });
        pushBuildSessionTransitionNotification(
          'warning',
          `Build start is still waiting at "${buildSessionTransition.phase}".`,
        );
        return;
      }
      emitBuildSessionTransitionLog('info', 'build session transition wait', {
        phase: buildSessionTransition.phase,
        elapsedMs,
      });
      pushBuildSessionTransitionNotification(
        'info',
        `Build start is taking longer than expected (${buildSessionTransition.phase}).`,
      );
    }, 1000);

    setBuildSessionTransitionElapsedMs(Math.max(0, Date.now() - buildSessionTransition.startedAt));
    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    buildSessionTransition.active,
    buildSessionTransition.phase,
    buildSessionTransition.startedAt,
    buildSessionTransitionWarnStepRef,
    emitBuildSessionTransitionLog,
    finishBuildStartupStep,
    finishBuildSessionTransition,
    pushBuildSessionTransitionNotification,
  ]);

  useEffect(() => {
    if (!buildSessionTransition.active || buildSessionTransition.phase !== 'waiting-lock') {
      buildSessionTransitionWaitLogStepRef.current = -1;
      return;
    }
    const intervalMs = UI_POLL_INTERVAL_MS;
    const tick = () => {
      const elapsedMs = Date.now() - buildSessionTransition.startedAt;
      const nextStep = Math.floor(elapsedMs / intervalMs);
      if (nextStep <= buildSessionTransitionWaitLogStepRef.current) return;
      buildSessionTransitionWaitLogStepRef.current = nextStep;
      emitBuildSessionTransitionLog('info', 'build session waiting for lock', {
        phase: buildSessionTransition.phase,
        elapsedMs,
        pollIntervalMs: intervalMs,
      });
    };
    tick();
    const intervalId = window.setInterval(tick, intervalMs);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    buildSessionTransition.active,
    buildSessionTransition.phase,
    buildSessionTransition.startedAt,
    buildSessionTransitionWaitLogStepRef,
    emitBuildSessionTransitionLog,
  ]);

  useEffect(() => {
    if (!buildSessionTransition.active) return;
    if (buildSessionTransition.phase !== 'awaiting-first-task') return;

    const decisionInput = {
      hasFirstTaskSignal,
      hasStartedTasks,
      hasProgressTaskSignal,
      buildStatus,
      taskCount: isTaskStreamReady ? displayTasks.length : undefined,
      isTaskStreamReady,
      expectTaskGeneration: awaitingFirstTaskExpectationRef.current,
      sessionProgressTotal,
      sessionStageId,
    };

    const decisionTraceKey = import.meta.env.DEV
      ? JSON.stringify({
        phase: buildSessionTransition.phase,
        buildStatus: decisionInput.buildStatus,
        hasFirstTaskSignal: decisionInput.hasFirstTaskSignal,
        hasStartedTasks: decisionInput.hasStartedTasks,
        hasProgressTaskSignal: decisionInput.hasProgressTaskSignal,
        taskCount: decisionInput.taskCount,
        isTaskStreamReady: decisionInput.isTaskStreamReady,
        expectTaskGeneration: decisionInput.expectTaskGeneration,
        sessionProgressTotal: decisionInput.sessionProgressTotal ?? null,
        sessionStageId: decisionInput.sessionStageId ?? null,
      })
      : null;

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

    if (decision.kind === 'success') {
      if (decision.taskExecutionStarted && !buildSessionTransitionTaskStartNotifiedRef.current) {
        buildSessionTransitionTaskStartNotifiedRef.current = true;
        emitBuildSessionTransitionLog('info', 'task execution started', {
          tasks: displayTasks.length,
          queuedOnly: decision.taskExecutionStarted.queuedOnly,
          hasProgressTaskSignal: decision.taskExecutionStarted.hasProgressTaskSignal,
        });
        if (decision.notification) {
          pushBuildSessionTransitionNotification(decision.notification.level, decision.notification.message);
        }
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
      return;
    }

    if (decision.kind === 'error') {
      finishBuildStartupStep('awaiting-first-task', 'error', {
        reason: decision.reason,
      });
      finishBuildSessionTransition(decision.transitionFinish);
      return;
    }

    finishBuildStartupStep('awaiting-first-task', 'cancelled', {
      reason: decision.reason,
    });
    finishBuildSessionTransition(decision.transitionFinish);
  }, [
    activeNodeId,
    buildStatus,
    buildSessionTransition.active,
    buildSessionTransition.phase,
    buildSessionTransitionTaskStartNotifiedRef,
    buildSessionTransition.startedAt,
    buildSessionTransitionWarnStepRef,
    buildSessionTransitionWaitLogStepRef,
    hasFirstTaskSignal,
    hasProgressTaskSignal,
    hasStartedTasks,
    isTaskStreamReady,
    lastAwaitingFirstTaskDecisionTraceKeyRef,
    sessionProgressTotal,
    sessionStageId,
    awaitingFirstTaskExpectationRef,
    displayTasks.length,
    emitBuildSessionTransitionLog,
    finishBuildStartupStep,
    finishBuildSessionTransition,
    pushBuildSessionTransitionNotification,
  ]);

  useEffect(() => {
    if (!isShapeProgressStepDebugEnabled()) return;
    const progressMessage = typeof effectiveProgress?.message === 'string'
      ? effectiveProgress.message.trim()
      : '';
    const progressDisplay = effectiveProgress?.progressTaskDisplay;
    if (!progressDisplay && !progressMessage) return;
    if (!buildSessionTransition.active && buildStatus !== 'running' && runtimeStatus !== 'processing') return;
    const progressTaskId = effectiveProgress?.progressTaskId;
    const progressTaskSequence = effectiveProgress?.progressTaskSequence;
    const progressTaskStatus = effectiveProgress?.progressTaskStatus;
    const progressTaskTitle = typeof effectiveProgress?.progressTaskTitle === 'string'
      ? effectiveProgress.progressTaskTitle.trim()
      : '';
    const canCheckStale = (
      typeof progressTaskId === 'string'
      && typeof progressTaskSequence === 'number'
      && Number.isFinite(progressTaskSequence)
      && (progressTaskStatus === 'running' || progressTaskStatus === 'queued')
    );
    if (canCheckStale) {
      const completedSequence = completedTaskSequenceById.get(progressTaskId);
      if (typeof completedSequence === 'number' && completedSequence >= progressTaskSequence) {
        return;
      }
    }
    const isPhaseMessage = isTaskPhaseDisplay(progressDisplay);
    const isTerminalUpdate = (
      progressTaskStatus === 'completed'
      || ((effectiveProgress?.percentage ?? 0) >= 100 && !isPhaseMessage)
    );
    if (!isTerminalUpdate) return;
    const key = `${progressTaskId ?? ''}:${progressTaskSequence ?? ''}:${progressTaskStatus ?? ''}:`
      + `${progressDisplay?.kind ?? ''}:${progressDisplay?.key ?? ''}:${progressMessage}`;
    if (progressTerminalLogKeyRef.current === key) return;
    progressTerminalLogKeyRef.current = key;
    emitBuildSessionTransitionLog('info', 'worker progress terminal update', {
      stage: resolvedTaskType ?? null,
      message: progressMessage || null,
      displayKind: progressDisplay?.kind ?? null,
      displayKey: progressDisplay?.key ?? null,
      percentage: effectiveProgress?.percentage ?? null,
      taskId: progressTaskId ?? null,
      taskTitle: progressTaskTitle || null,
      taskSequence: progressTaskSequence ?? null,
      taskStatus: progressTaskStatus ?? null,
    });
  }, [
    buildStatus,
    runtimeStatus,
    buildSessionTransition.active,
    effectiveProgress?.message,
    effectiveProgress?.percentage,
    effectiveProgress?.progressTaskDisplay,
    effectiveProgress?.progressTaskId,
    effectiveProgress?.progressTaskSequence,
    effectiveProgress?.progressTaskStatus,
    effectiveProgress?.progressTaskTitle,
    completedTaskSequenceById,
    emitBuildSessionTransitionLog,
    progressTerminalLogKeyRef,
    resolvedTaskType,
  ]);

  return {
    buildSessionTransitionElapsedMs,
  };
};
