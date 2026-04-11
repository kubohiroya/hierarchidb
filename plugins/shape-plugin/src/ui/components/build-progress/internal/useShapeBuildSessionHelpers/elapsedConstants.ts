export const runWithTimeout = async <T>(
  action: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
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
  pollIntervalMs: number = 500,
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

export const shallowEqualNumberRecord = (left: Record<string, number>, right: Record<string, number>): boolean => {
  if (left === right) return true;
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => left[key] === right[key]);
};

export const sumNumberRecord = (values: Record<string, number>): number => (
  Object.values(values).reduce((acc, value) => acc + (Number.isFinite(value) ? value : 0), 0)
);

export const buildElapsedByStageWithActiveStage = (params: {
  stageDurationByStage: Record<string, number>;
  timingStageId: string | null;
  timingStageElapsedMs: number;
}): Record<string, number> => {
  const { stageDurationByStage, timingStageId, timingStageElapsedMs } = params;
  if (!timingStageId) {
    return stageDurationByStage;
  }
  const currentElapsedMs = stageDurationByStage[timingStageId] ?? 0;
  const nextElapsedMs = Math.max(currentElapsedMs, timingStageElapsedMs);
  if (nextElapsedMs === currentElapsedMs) {
    return stageDurationByStage;
  }
  return {
    ...stageDurationByStage,
    [timingStageId]: nextElapsedMs,
  };
};

export const resolveTotalElapsedMs = (params: {
  buildStatus: import('@hierarchidb/ui-build-progress/build-status').BuildStatus;
  stageDurationByStage: Record<string, number>;
  sessionDurationMs: number;
}): number => {
  const stageTotalElapsedMs = sumNumberRecord(params.stageDurationByStage);
  if (params.buildStatus === 'running') {
    return stageTotalElapsedMs;
  }
  return Math.max(stageTotalElapsedMs, params.sessionDurationMs);
};

export const hasPositiveDuration = (values: Record<string, number>): boolean => (
  Object.values(values).some((value) => Number.isFinite(value) && value > 0)
);

export const mergeElapsedByStage = (
  currentStageDurationByStage: Record<string, number>,
  snapshotStageDurationByStage: Record<string, number>,
): Record<string, number> => {
  const next: Record<string, number> = { ...currentStageDurationByStage };
  Object.entries(snapshotStageDurationByStage).forEach(([stageId, snapshotDurationMs]) => {
    if (!Number.isFinite(snapshotDurationMs) || snapshotDurationMs < 0) return;
    const currentMs = next[stageId] ?? 0;
    if (snapshotDurationMs > currentMs) {
      next[stageId] = snapshotDurationMs;
    }
  });
  return next;
};

export const shouldResetElapsedState = (params: {
  buildStatus: import('@hierarchidb/ui-build-progress/build-status').BuildStatus;
  buildDurationMs: number | undefined;
  sessionStageDurationByStage: Record<string, number>;
  localStageDurationByStage: Record<string, number>;
}): boolean => {
  if (params.buildStatus === 'running') return false;
  if (hasPositiveDuration(params.sessionStageDurationByStage)) return false;
  if (typeof params.buildDurationMs === 'number' && params.buildDurationMs > 0) return false;
  if (hasPositiveDuration(params.localStageDurationByStage)) return false;
  return true;
};
