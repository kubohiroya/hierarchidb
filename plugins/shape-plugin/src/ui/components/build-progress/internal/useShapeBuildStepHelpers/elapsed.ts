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
  elapsedByStage: Record<string, number>;
  timingStageId: string | null;
  timingStageElapsedMs: number;
}): Record<string, number> => {
  const { elapsedByStage, timingStageId, timingStageElapsedMs } = params;
  if (!timingStageId) {
    return elapsedByStage;
  }
  const currentElapsedMs = elapsedByStage[timingStageId] ?? 0;
  const nextElapsedMs = Math.max(currentElapsedMs, timingStageElapsedMs);
  if (nextElapsedMs === currentElapsedMs) {
    return elapsedByStage;
  }
  return {
    ...elapsedByStage,
    [timingStageId]: nextElapsedMs,
  };
};

export const resolveTotalElapsedMs = (params: {
  buildStatus: import('@hierarchidb/components/build-status').BuildStatus;
  elapsedByStage: Record<string, number>;
  sessionElapsedMs: number;
}): number => {
  const stageTotalElapsedMs = sumNumberRecord(params.elapsedByStage);
  if (params.buildStatus === 'running') {
    return stageTotalElapsedMs;
  }
  return Math.max(stageTotalElapsedMs, params.sessionElapsedMs);
};

export const hasPositiveElapsed = (values: Record<string, number>): boolean => (
  Object.values(values).some((value) => Number.isFinite(value) && value > 0)
);

export const mergeElapsedByStage = (
  current: Record<string, number>,
  persisted: Record<string, number>,
): Record<string, number> => {
  const next: Record<string, number> = { ...current };
  Object.entries(persisted).forEach(([stageId, persistedMs]) => {
    if (!Number.isFinite(persistedMs) || persistedMs < 0) return;
    const currentMs = next[stageId] ?? 0;
    if (persistedMs > currentMs) {
      next[stageId] = persistedMs;
    }
  });
  return next;
};

export const shouldResetElapsedState = (params: {
  buildStatus: import('@hierarchidb/components/build-status').BuildStatus;
  buildElapsedMs: number | undefined;
  stageElapsedByStage: Record<string, number>;
  localElapsedByStage: Record<string, number>;
}): boolean => {
  if (params.buildStatus === 'running') return false;
  if (hasPositiveElapsed(params.stageElapsedByStage)) return false;
  if (typeof params.buildElapsedMs === 'number' && params.buildElapsedMs > 0) return false;
  if (hasPositiveElapsed(params.localElapsedByStage)) return false;
  return true;
};
