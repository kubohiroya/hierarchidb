import type { CrashInsight } from '@hierarchidb/ui-monitoring';

export type ShapeBuildStage = 'download' | 'extract1' | 'extract2' | 'vectorTiles';

export type ShapeBuildConfigSnapshot = {
  downloadConcurrency?: number;
  extract1Workers?: number;
  extract2Workers?: number;
  tileWorkers?: number;
};

export const getStageConcurrencyWarning = (
  insight: CrashInsight<ShapeBuildStage, ShapeBuildConfigSnapshot> | null,
  stage: ShapeBuildStage,
  currentValue?: number,
): { message: string; threshold?: number } | null => {
  if (!insight || insight.stage !== stage) return null;
  if (!insight.memoryPressure) return null;
  if (currentValue == null) return null;
  const snapshot = insight.configSnapshot;
  const threshold = (() => {
    switch (stage) {
      case 'download':
        return snapshot?.downloadConcurrency;
      case 'extract1':
        return snapshot?.extract1Workers;
      case 'extract2':
        return snapshot?.extract2Workers;
      case 'vectorTiles':
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
  extract1Workers: config?.extract1Config?.workers,
  extract2Workers: config?.extract2Config?.workers,
  tileWorkers: config?.tileConfig?.workers,
});
