import { notify } from '@hierarchidb/components/notify';
import type { BuildSessionTransitionNotificationLevel } from '@hierarchidb/ui-build-progress/build-session';
import { useBuildSessionTransition } from '@hierarchidb/ui-build-progress/build-session';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type {
  BuildSessionTransitionPhase,
  BuildStartupStep,
  BuildStartupStepOutcome,
  StartupStepMemorySnapshot,
} from '~/ui/components/build-progress/internal/useShapeBuildSessionHelpers/startupTrace.js';
import {
  calculateMemoryDelta,
  captureStartupStepMemorySnapshot,
} from '~/ui/components/build-progress/internal/useShapeBuildSessionHelpers/startupTrace.js';

type NotificationLevel = BuildSessionTransitionNotificationLevel;

type UseShapeBuildSessionTransitionControllerArgs = {
  activeNodeId: string | null;
  clearStartPendingRef: React.RefObject<(() => void) | null>;
};

type UseShapeBuildSessionTransitionControllerResult = {
  buildSessionTransition: {
    active: boolean;
    phase: BuildSessionTransitionPhase | 'idle';
    startedAt: number;
  };
  beginBuildSessionTransition: (phase: BuildSessionTransitionPhase, message?: string) => void;
  advanceBuildSessionTransitionPhase: (
    phase: BuildSessionTransitionPhase,
    options?: { message?: string; level?: NotificationLevel }
  ) => void;
  finishBuildSessionTransition: (options?: { message?: string; level?: NotificationLevel }) => void;
  emitBuildSessionTransitionLog: (
    level: 'info' | 'warn' | 'error',
    message: string,
    payload?: Record<string, unknown>
  ) => void;
  pushBuildSessionTransitionNotification: (level: NotificationLevel, message: string) => void;
  beginBuildStartupStep: (step: BuildStartupStep, extra?: Record<string, unknown>) => void;
  finishBuildStartupStep: (
    step: BuildStartupStep,
    outcome: BuildStartupStepOutcome,
    extra?: Record<string, unknown>
  ) => void;
  progressTerminalLogKeyRef: { current: string | null };
};

export type {
  UseShapeBuildSessionTransitionControllerArgs,
  UseShapeBuildSessionTransitionControllerResult,
  NotificationLevel,
};

export const useShapeBuildSessionTransitionController = ({
  activeNodeId,
  clearStartPendingRef,
}: UseShapeBuildSessionTransitionControllerArgs): UseShapeBuildSessionTransitionControllerResult => {
  const progressTerminalLogKeyRef = useRef<string | null>(null);
  const previousTransitionActiveRef = useRef(false);
  const buildStartupStepStartedAtRef = useRef<Map<BuildStartupStep, number>>(new Map());
  const buildStartupStepMemoryAtStartRef = useRef<Map<BuildStartupStep, StartupStepMemorySnapshot>>(
    new Map()
  );

  const buildSessionTransitionContext = useMemo(
    () => ({
      nodeId: activeNodeId ? String(activeNodeId) : null,
    }),
    [activeNodeId]
  );

  const handleBuildSessionTransitionNotify = useCallback(
    (level: NotificationLevel, message: string) => {
      if (level === 'error') {
        notify.error(message);
        return;
      }
      if (level === 'warning') {
        notify.warning(message);
        return;
      }
      if (level === 'success') {
        notify.success(message);
        return;
      }
      notify.info(message);
    },
    []
  );

  const handleBuildSessionTransitionFinish = useCallback(() => {
    clearStartPendingRef.current?.();
    progressTerminalLogKeyRef.current = null;
  }, [clearStartPendingRef]);

  const {
    buildSessionTransition,
    beginBuildSessionTransition: beginBuildSessionTransitionInternal,
    advanceBuildSessionTransitionPhase: advanceBuildSessionTransitionPhaseInternal,
    finishBuildSessionTransition: finishBuildSessionTransitionInternal,
    emitBuildSessionTransitionLog,
    pushBuildSessionTransitionNotification,
  } = useBuildSessionTransition<BuildSessionTransitionPhase>({
    logPrefix: '[ShapeBuildProgressStep]',
    context: buildSessionTransitionContext,
    onNotify: handleBuildSessionTransitionNotify,
    onFinish: handleBuildSessionTransitionFinish,
  });

  const beginBuildSessionTransition = useCallback(
    (phase: BuildSessionTransitionPhase, message?: string) => {
      const now = Date.now();
      progressTerminalLogKeyRef.current = null;
      beginBuildSessionTransitionInternal(phase, {
        message,
        level: 'info',
        extra: { startedAt: now },
      });
    },
    [beginBuildSessionTransitionInternal]
  );

  const advanceBuildSessionTransitionPhase = useCallback(
    (
      phase: BuildSessionTransitionPhase,
      options?: {
        message?: string;
        level?: NotificationLevel;
      }
    ) => {
      advanceBuildSessionTransitionPhaseInternal(phase, {
        message: options?.message,
        level: options?.level ?? 'info',
      });
    },
    [advanceBuildSessionTransitionPhaseInternal]
  );

  const finishBuildSessionTransition = useCallback(
    (options?: { message?: string; level?: NotificationLevel }) => {
      finishBuildSessionTransitionInternal(options);
    },
    [finishBuildSessionTransitionInternal]
  );

  const beginBuildStartupStep = useCallback(
    (step: BuildStartupStep, extra?: Record<string, unknown>) => {
      const startedAt = Date.now();
      const memoryAtStart = captureStartupStepMemorySnapshot();
      buildStartupStepStartedAtRef.current.set(step, startedAt);
      buildStartupStepMemoryAtStartRef.current.set(step, memoryAtStart);
      emitBuildSessionTransitionLog('info', 'build startup step start', {
        step,
        startedAt,
        memory: memoryAtStart,
        ...(extra ?? {}),
      });
    },
    [emitBuildSessionTransitionLog]
  );

  const finishBuildStartupStep = useCallback(
    (step: BuildStartupStep, outcome: BuildStartupStepOutcome, extra?: Record<string, unknown>) => {
      const now = Date.now();
      const startedAt = buildStartupStepStartedAtRef.current.get(step);
      const memoryAtStart = buildStartupStepMemoryAtStartRef.current.get(step) ?? null;
      buildStartupStepStartedAtRef.current.delete(step);
      buildStartupStepMemoryAtStartRef.current.delete(step);
      const memoryAtFinish = captureStartupStepMemorySnapshot();
      const memoryDelta = calculateMemoryDelta(memoryAtStart, memoryAtFinish);
      const durationMs = typeof startedAt === 'number' ? Math.max(0, now - startedAt) : null;
      const level = outcome === 'error' ? 'error' : outcome === 'success' ? 'info' : 'warn';
      emitBuildSessionTransitionLog(level, 'build startup step finish', {
        step,
        outcome,
        startedAt: startedAt ?? null,
        finishedAt: now,
        durationMs,
        memoryAtStart,
        memoryAtFinish,
        memoryDelta,
        ...(extra ?? {}),
      });
    },
    [emitBuildSessionTransitionLog]
  );

  useEffect(() => {
    const wasActive = previousTransitionActiveRef.current;
    if (wasActive && !buildSessionTransition.active) {
      const pendingSteps = Array.from(buildStartupStepStartedAtRef.current.keys());
      pendingSteps.forEach((step) => {
        finishBuildStartupStep(step, 'aborted', {
          reason: 'transition-finished-before-step-completed',
        });
      });
    }
    previousTransitionActiveRef.current = buildSessionTransition.active;
  }, [buildSessionTransition.active, finishBuildStartupStep]);

  return {
    buildSessionTransition,
    beginBuildSessionTransition,
    advanceBuildSessionTransitionPhase,
    finishBuildSessionTransition,
    emitBuildSessionTransitionLog,
    pushBuildSessionTransitionNotification,
    beginBuildStartupStep,
    finishBuildStartupStep,
    progressTerminalLogKeyRef,
  };
};
