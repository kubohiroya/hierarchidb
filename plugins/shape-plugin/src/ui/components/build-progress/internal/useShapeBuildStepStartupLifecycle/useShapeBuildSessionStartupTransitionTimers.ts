import { useEffect } from 'react';
import { resolveStartupTransitionWatchdogEvent } from '../../resolveStartupTransitionWatchdogEvent';
import { UI_POLL_INTERVAL_MS } from '../useShapeBuildStepHelpers/constants';
import type {
  BuildSessionTransitionNotificationLevel,
  BuildSessionTransitionState,
} from '@hierarchidb/components/build-session';
import type {
  BuildSessionTransitionPhase,
  BuildStartupStep,
  BuildStartupStepOutcome,
} from '../useShapeBuildStepHelpers/startupTrace';

type UseShapeBuildSessionStartupTransitionTimersArgs = {
  buildSessionTransition: BuildSessionTransitionState<BuildSessionTransitionPhase>;
  setBuildSessionTransitionElapsedMs: (value: number) => void;
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

const handleTimeout = (
  elapsedMs: number,
  phase: BuildSessionTransitionPhase,
  finishBuildStartupStep: UseShapeBuildSessionStartupTransitionTimersArgs['finishBuildStartupStep'],
  finishBuildSessionTransition: UseShapeBuildSessionStartupTransitionTimersArgs['finishBuildSessionTransition'],
  emitBuildSessionTransitionLog: UseShapeBuildSessionStartupTransitionTimersArgs['emitBuildSessionTransitionLog'],
): void => {
  emitBuildSessionTransitionLog('error', 'build session transition timeout', {
    phase,
    elapsedMs,
  });
  if (phase === 'receiving-task-snapshot') {
    finishBuildStartupStep('receiving-task-snapshot', 'error', {
      reason: 'timeout-before-task-start',
      elapsedMs,
    });
  }
  finishBuildSessionTransition({
    level: 'error',
    message: `Build did not start task processing (${phase}, ${Math.round(elapsedMs / 1000)}s).`,
  });
};

const handleLongWait = (
  elapsedMs: number,
  phase: BuildSessionTransitionPhase,
  emitBuildSessionTransitionLog: UseShapeBuildSessionStartupTransitionTimersArgs['emitBuildSessionTransitionLog'],
  pushBuildSessionTransitionNotification: UseShapeBuildSessionStartupTransitionTimersArgs['pushBuildSessionTransitionNotification'],
): void => {
  emitBuildSessionTransitionLog('warn', 'build session transition long wait', {
    phase,
    elapsedMs,
  });
  pushBuildSessionTransitionNotification(
    'warning',
    `Build start is still waiting at \"${phase}\".`,
  );
};

const handleWait = (
  elapsedMs: number,
  phase: BuildSessionTransitionPhase,
  emitBuildSessionTransitionLog: UseShapeBuildSessionStartupTransitionTimersArgs['emitBuildSessionTransitionLog'],
  pushBuildSessionTransitionNotification: UseShapeBuildSessionStartupTransitionTimersArgs['pushBuildSessionTransitionNotification'],
): void => {
  emitBuildSessionTransitionLog('info', 'build session transition wait', {
    phase,
    elapsedMs,
  });
  pushBuildSessionTransitionNotification(
    'info',
    `Build start is taking longer than expected (${phase}).`,
  );
};

export const useShapeBuildSessionStartupTransitionTimers = ({
  buildSessionTransition,
  setBuildSessionTransitionElapsedMs,
  buildSessionTransitionWarnStepRef,
  buildSessionTransitionWaitLogStepRef,
  emitBuildSessionTransitionLog,
  pushBuildSessionTransitionNotification,
  finishBuildStartupStep,
  finishBuildSessionTransition,
}: UseShapeBuildSessionStartupTransitionTimersArgs): void => {
  useEffect(() => {
    const phase = buildSessionTransition.phase;
    if (phase === 'idle') {
      setBuildSessionTransitionElapsedMs(0);
      return;
    }
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
        handleTimeout(
          elapsedMs,
          phase,
          finishBuildStartupStep,
          finishBuildSessionTransition,
          emitBuildSessionTransitionLog,
        );
        return;
      }
      if (watchdogEvent.kind === 'long-wait') {
        handleLongWait(
          elapsedMs,
          phase,
          emitBuildSessionTransitionLog,
          pushBuildSessionTransitionNotification,
        );
        return;
      }
      handleWait(
        elapsedMs,
        phase,
        emitBuildSessionTransitionLog,
        pushBuildSessionTransitionNotification,
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
    setBuildSessionTransitionElapsedMs,
  ]);

  useEffect(() => {
    if (!buildSessionTransition.active || buildSessionTransition.phase !== 'waiting-lock') {
      buildSessionTransitionWaitLogStepRef.current = -1;
      return;
    }
    const tick = () => {
      const elapsedMs = Date.now() - buildSessionTransition.startedAt;
      const nextStep = Math.floor(elapsedMs / UI_POLL_INTERVAL_MS);
      if (nextStep <= buildSessionTransitionWaitLogStepRef.current) return;
      buildSessionTransitionWaitLogStepRef.current = nextStep;
      emitBuildSessionTransitionLog('info', 'build session waiting for lock', {
        phase: buildSessionTransition.phase,
        elapsedMs,
        pollIntervalMs: UI_POLL_INTERVAL_MS,
      });
    };
    tick();
    const intervalId = window.setInterval(tick, UI_POLL_INTERVAL_MS);
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
};
