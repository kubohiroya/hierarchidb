import type { CrashInsight } from '@hierarchidb/ui-monitoring';

export type ShapeBuildStage =
  | 'fetch'
  | 'transform'
  | 'vt';

export type ShapeBuildConfigSnapshot = {
  downloadConcurrency?: number;
  transformWorkers?: number;
  tileWorkers?: number;
};

export const getStageConcurrencyWarning = (
  insight: CrashInsight<ShapeBuildStage, ShapeBuildConfigSnapshot> | null,
  stage: ShapeBuildStage,
  currentValue?: number,
): { message: string; threshold?: number } | null => {
  const insightStage = insight?.stage;
  if (!insight || !stage || insightStage !== stage) return null;
  if (!insight.memoryPressure) return null;
  if (currentValue == null) return null;
  const snapshot = insight.configSnapshot;
  const threshold = (() => {
    switch (stage) {
      case 'fetch':
        return snapshot?.downloadConcurrency;
      case 'transform':
        return snapshot?.transformWorkers;
      case 'vt':
        return snapshot?.tileWorkers;
      default:
        return undefined;
    }
  })();
  if (threshold == null || currentValue < threshold) return null;
  const ratioText = insight.peakRatio ? `peak ${(insight.peakRatio * 100).toFixed(1)}%` : 'peak unknown';
  return {
    threshold,
    message: `Last crash suspected in ${stage} (${ratioText}). Reduce concurrency below ${threshold}.`,
  };
};

export const getBuildConfigSnapshot = (config?: {
  downloadConfig?: { maxConcurrent?: number };
  extract1Config?: { workers?: number };
  extract2Config?: { workers?: number };
  tileConfig?: { workers?: number };
}): ShapeBuildConfigSnapshot => ({
  downloadConcurrency: config?.downloadConfig?.maxConcurrent,
  transformWorkers: config?.extract2Config?.workers ?? config?.extract1Config?.workers,
  tileWorkers: config?.tileConfig?.workers,
});
