import type { BuildStatus } from '@hierarchidb/ui-build-progress/build-status';

const requireFiniteNonNegativeNumber = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(
      `[shape elapsed] ${label} must be a finite non-negative number, received ${String(value)}`
    );
  }
  return value;
};

const resolveInactiveMs = (inactiveMs: number | undefined, label: string): number =>
  inactiveMs === undefined ? 0 : requireFiniteNonNegativeNumber(inactiveMs, label);

export const resolveStageElapsedMs = (params: {
  stageStartedAt: number;
  stageInactiveMs: number;
  endAt: number;
}): number => {
  const stageStartedAt = requireFiniteNonNegativeNumber(params.stageStartedAt, 'stageStartedAt');
  const stageInactiveMs = requireFiniteNonNegativeNumber(params.stageInactiveMs, 'stageInactiveMs');
  const endAt = requireFiniteNonNegativeNumber(params.endAt, 'stage endAt');
  const durationMs = endAt - stageStartedAt - stageInactiveMs;
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new Error(
      `[shape elapsed] stage duration must be finite and non-negative, received ${durationMs}`
    );
  }
  return durationMs;
};

export const resolveSessionElapsedMs = (params: {
  buildStatus: BuildStatus;
  startedAt?: number;
  completedAt?: number;
  heartbeatAt?: number;
  inactiveMs?: number;
  now: number;
}): number => {
  const startedAt =
    params.startedAt === undefined
      ? undefined
      : requireFiniteNonNegativeNumber(params.startedAt, 'startedAt');
  const inactiveMs = resolveInactiveMs(params.inactiveMs, 'inactiveMs');
  const completedAt =
    params.completedAt === undefined
      ? undefined
      : requireFiniteNonNegativeNumber(params.completedAt, 'completedAt');

  if (params.buildStatus === 'idle') {
    if (startedAt !== undefined && completedAt !== undefined) {
      const durationMs = completedAt - startedAt - inactiveMs;
      if (!Number.isFinite(durationMs) || durationMs < 0) {
        throw new Error(
          `[shape elapsed] session duration must be finite and non-negative, received ${durationMs}`
        );
      }
    }
    return 0;
  }

  if (startedAt === undefined) {
    throw new Error(
      '[shape elapsed] startedAt must be a finite non-negative number, received undefined'
    );
  }
  let endAt: number;
  if (params.buildStatus === 'running') {
    endAt = requireFiniteNonNegativeNumber(params.now, 'now');
  } else if (params.buildStatus === 'paused') {
    endAt = requireFiniteNonNegativeNumber(params.heartbeatAt, 'heartbeatAt');
  } else {
    endAt = requireFiniteNonNegativeNumber(completedAt, 'completedAt');
  }
  const durationMs = endAt - startedAt - inactiveMs;
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new Error(
      `[shape elapsed] session duration must be finite and non-negative, received ${durationMs}`
    );
  }
  return durationMs;
};

export const runWithTimeout = async <T>(
  action: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      action,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(timeoutMessage));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== null) clearTimeout(timeoutId);
  }
};

// セッション状態の同期を待機する関数
export const waitForSessionStateSync = async (
  checkCondition: () => boolean,
  timeoutMs: number,
  pollIntervalMs: number = 500
): Promise<boolean> => {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const check = () => {
      if (checkCondition()) {
        resolve(true);
        return;
      }

      if (Date.now() - startTime >= timeoutMs) {
        resolve(false);
        return;
      }

      setTimeout(check, pollIntervalMs);
    };

    check();
  });
};

export const shallowEqualNumberRecord = (
  left: Record<string, number>,
  right: Record<string, number>
): boolean => {
  if (left === right) return true;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => left[key] === right[key]);
};

export const sumNumberRecord = (values: Record<string, number>): number =>
  Object.entries(values).reduce(
    (acc, [stageId, value]) =>
      acc + requireFiniteNonNegativeNumber(value, `stageDurationByStage.${stageId}`),
    0
  );

export const buildElapsedByStageWithActiveStage = (params: {
  stageDurationByStage: Record<string, number>;
  timingStageId: string | null;
  timingStageElapsedMs: number;
}): Record<string, number> => {
  const { stageDurationByStage, timingStageId, timingStageElapsedMs } = params;
  sumNumberRecord(stageDurationByStage);
  if (!timingStageId) {
    return stageDurationByStage;
  }
  const currentValue = stageDurationByStage[timingStageId];
  const currentElapsedMs =
    currentValue === undefined
      ? 0
      : requireFiniteNonNegativeNumber(currentValue, `stageDurationByStage.${timingStageId}`);
  const validatedTimingStageElapsedMs = requireFiniteNonNegativeNumber(
    timingStageElapsedMs,
    `timingStageElapsedMs.${timingStageId}`
  );
  const nextElapsedMs = Math.max(currentElapsedMs, validatedTimingStageElapsedMs);
  if (nextElapsedMs === currentElapsedMs) {
    return stageDurationByStage;
  }
  return {
    ...stageDurationByStage,
    [timingStageId]: nextElapsedMs,
  };
};

export const resolveTotalElapsedMs = (params: {
  buildStatus: BuildStatus;
  stageDurationByStage: Record<string, number>;
  sessionDurationMs: number;
}): number => {
  const stageTotalElapsedMs = sumNumberRecord(params.stageDurationByStage);
  const sessionDurationMs = requireFiniteNonNegativeNumber(
    params.sessionDurationMs,
    'sessionDurationMs'
  );
  if (params.buildStatus === 'running') {
    return stageTotalElapsedMs;
  }
  return Math.max(stageTotalElapsedMs, sessionDurationMs);
};

export const hasPositiveDuration = (values: Record<string, number>): boolean => {
  let hasPositive = false;
  for (const [stageId, value] of Object.entries(values)) {
    if (requireFiniteNonNegativeNumber(value, `stageDurationByStage.${stageId}`) > 0) {
      hasPositive = true;
    }
  }
  return hasPositive;
};

export const mergeElapsedByStage = (
  currentStageDurationByStage: Record<string, number>,
  snapshotStageDurationByStage: Record<string, number>
): Record<string, number> => {
  hasPositiveDuration(currentStageDurationByStage);
  const next: Record<string, number> = { ...currentStageDurationByStage };
  Object.entries(snapshotStageDurationByStage).forEach(([stageId, snapshotDurationMs]) => {
    requireFiniteNonNegativeNumber(snapshotDurationMs, `snapshotStageDurationByStage.${stageId}`);
    const currentValue = next[stageId];
    const currentMs =
      currentValue === undefined
        ? 0
        : requireFiniteNonNegativeNumber(currentValue, `currentStageDurationByStage.${stageId}`);
    if (snapshotDurationMs > currentMs) {
      next[stageId] = snapshotDurationMs;
    }
  });
  return next;
};

export const shouldResetElapsedState = (params: {
  buildStatus: BuildStatus;
  buildDurationMs: number | undefined;
  sessionStageDurationByStage: Record<string, number>;
  localStageDurationByStage: Record<string, number>;
}): boolean => {
  const buildDurationMs =
    params.buildDurationMs === undefined
      ? undefined
      : requireFiniteNonNegativeNumber(params.buildDurationMs, 'buildDurationMs');
  const hasSessionStageDuration = hasPositiveDuration(params.sessionStageDurationByStage);
  const hasLocalStageDuration = hasPositiveDuration(params.localStageDurationByStage);
  if (params.buildStatus === 'running') return false;
  if (hasSessionStageDuration) return false;
  if (buildDurationMs !== undefined && buildDurationMs > 0) return false;
  if (hasLocalStageDuration) return false;
  return true;
};
