import type { CrashInsight } from '@hierarchidb/ui-monitoring';

export type ShapeBuildStage = 'download' | 'simplify1' | 'simplify2' | 'vectorTiles';

export type ShapeBuildConfigSnapshot = {
  downloadConcurrency?: number;
  simplify1Workers?: number;
  simplify2Workers?: number;
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
      case 'simplify1':
        return snapshot?.simplify1Workers;
      case 'simplify2':
        return snapshot?.simplify2Workers;
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
  simplify1Config?: { workers?: number };
  simplify2Config?: { workers?: number };
  tileConfig?: { workers?: number };
}): ShapeBuildConfigSnapshot => ({
  downloadConcurrency: config?.downloadConfig?.maxConcurrent,
  simplify1Workers: config?.simplify1Config?.workers,
  simplify2Workers: config?.simplify2Config?.workers,
  tileWorkers: config?.tileConfig?.workers,
});
