import { useCallback, useMemo, useState } from 'react';

export type BuildSessionTransitionState<Phase extends string> = {
  active: boolean;
  phase: Phase | 'idle';
  startedAt: number;
};

export type BuildSessionTransitionNotificationLevel = 'info' | 'warning' | 'error' | 'success';
export type BuildSessionTransitionLogLevel = 'info' | 'warn' | 'error';

type TransitionMessageOptions = {
  message?: string;
  level?: BuildSessionTransitionNotificationLevel;
  extra?: Record<string, unknown>;
};

type UseBuildSessionTransitionOptions = {
  logPrefix: string;
  context?: Record<string, unknown>;
  onLog?: (level: BuildSessionTransitionLogLevel, event: string, payload: Record<string, unknown>) => void;
  onNotify?: (level: BuildSessionTransitionNotificationLevel, message: string) => void;
  onFinish?: () => void;
};

const logWithConsole = (
  prefix: string,
  level: BuildSessionTransitionLogLevel,
  event: string,
  payload: Record<string, unknown>,
): void => {
  if (level === 'error') {
    console.error(`${prefix} ${event}`, payload);
    return;
  }
  if (level === 'warn') {
    console.warn(`${prefix} ${event}`, payload);
    return;
  }
  console.info(`${prefix} ${event}`, payload);
};

export const useBuildSessionTransition = <Phase extends string>({
  logPrefix,
  context,
  onLog,
  onNotify,
  onFinish,
}: UseBuildSessionTransitionOptions) => {
  const [buildSessionTransition, setBuildSessionTransition] = useState<BuildSessionTransitionState<Phase>>({
    active: false,
    phase: 'idle',
    startedAt: 0,
  });

  const baseContext = useMemo(() => context ?? {}, [context]);

  const emitBuildSessionTransitionLog = useCallback((
    level: BuildSessionTransitionLogLevel,
    event: string,
    extra?: Record<string, unknown>,
  ) => {
    const payload = { ...baseContext, ...(extra ?? {}) };
    if (onLog) {
      onLog(level, event, payload);
      return;
    }
    logWithConsole(logPrefix, level, event, payload);
  }, [baseContext, logPrefix, onLog]);

  const pushBuildSessionTransitionNotification = useCallback((
    level: BuildSessionTransitionNotificationLevel,
    message: string,
  ) => {
    if (!onNotify) return;
    onNotify(level, message);
  }, [onNotify]);

  const beginBuildSessionTransition = useCallback((phase: Phase, options?: TransitionMessageOptions) => {
    const now = Date.now();
    setBuildSessionTransition({ active: true, phase, startedAt: now });
    emitBuildSessionTransitionLog('info', 'build session transition begin', { phase, ...(options?.extra ?? {}) });
    if (options?.message) {
      pushBuildSessionTransitionNotification(options.level ?? 'info', options.message);
    }
  }, [emitBuildSessionTransitionLog, pushBuildSessionTransitionNotification]);

  const advanceBuildSessionTransitionPhase = useCallback((phase: Phase, options?: TransitionMessageOptions) => {
    setBuildSessionTransition((current) => ({
      active: true,
      phase,
      startedAt: current.active ? current.startedAt : Date.now(),
    }));
    emitBuildSessionTransitionLog('info', 'build session transition phase', { phase, ...(options?.extra ?? {}) });
    if (options?.message) {
      pushBuildSessionTransitionNotification(options.level ?? 'info', options.message);
    }
  }, [emitBuildSessionTransitionLog, pushBuildSessionTransitionNotification]);

  const finishBuildSessionTransition = useCallback((options?: TransitionMessageOptions) => {
    setBuildSessionTransition({ active: false, phase: 'idle', startedAt: 0 });
    onFinish?.();
    if (options?.message) {
      const level = options.level ?? 'info';
      emitBuildSessionTransitionLog(
        level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'info',
        'build session transition finish',
        { message: options.message, ...(options.extra ?? {}) },
      );
      pushBuildSessionTransitionNotification(level, options.message);
      return;
    }
    emitBuildSessionTransitionLog('info', 'build session transition finish');
  }, [emitBuildSessionTransitionLog, onFinish, pushBuildSessionTransitionNotification]);

  return {
    buildSessionTransition,
    beginBuildSessionTransition,
    advanceBuildSessionTransitionPhase,
    finishBuildSessionTransition,
    emitBuildSessionTransitionLog,
    pushBuildSessionTransitionNotification,
  };
};

