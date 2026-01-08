import type { CrashInsight } from '@hierarchidb/ui-monitoring';

export type ShapeBuildStage =
  | 'fetch'
  | 'transform'
  | 'vt'
  | 'download'
  | 'extract1'
  | 'extract2'
  | 'vectorTiles';

export type ShapeBuildConfigSnapshot = {
  downloadConcurrency?: number;
  transformWorkers?: number;
  tileWorkers?: number;
};

export const normalizeShapeBuildStage = (stage?: string): 'fetch' | 'transform' | 'vt' | undefined => {
  if (!stage) return undefined;
  switch (stage) {
    case 'download':
    case 'shape-fetch':
    case 'fetch':
      return 'fetch';
    case 'extract1':
    case 'extract2':
    case 'transform':
      return 'transform';
    case 'vectortile':
    case 'vectorTiles':
    case 'vt':
      return 'vt';
    default:
      return undefined;
  }
};

export const getStageConcurrencyWarning = (
  insight: CrashInsight<ShapeBuildStage, ShapeBuildConfigSnapshot> | null,
  stage: ShapeBuildStage,
  currentValue?: number,
): { message: string; threshold?: number } | null => {
  const normalizedStage = normalizeShapeBuildStage(stage);
  const normalizedInsightStage = normalizeShapeBuildStage(insight?.stage);
  if (!insight || !normalizedStage || normalizedInsightStage !== normalizedStage) return null;
  if (!insight.memoryPressure) return null;
  if (currentValue == null) return null;
  const snapshot = insight.configSnapshot;
  const threshold = (() => {
    switch (normalizedStage) {
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
