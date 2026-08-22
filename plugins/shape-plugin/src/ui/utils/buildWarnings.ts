import type { CrashInsight } from '@hierarchidb/ui-monitoring';
import { normalizeUiStageId } from '~/ui/components/build-progress/stageIdAliases';

export type ShapeBuildStage = 'source' | 'geometry' | 'tileEmit';

export type ShapeBuildConfigSnapshot = {
  downloadConcurrency?: number;
  geometryWorkers?: number;
  tileWorkers?: number;
};

export const getStageConcurrencyWarning = (
  insight: CrashInsight<ShapeBuildStage, ShapeBuildConfigSnapshot> | null,
  stage: ShapeBuildStage,
  currentValue?: number
): { message: string; threshold?: number } | null => {
  const insightStage = normalizeUiStageId(insight?.stage);
  const normalizedStage = normalizeUiStageId(stage);
  if (!insight || !normalizedStage || insightStage !== normalizedStage) return null;
  if (!insight.memoryPressure) return null;
  if (currentValue == null) return null;
  const snapshot = insight.configSnapshot;
  const threshold = (() => {
    switch (normalizedStage) {
      case 'source':
        return snapshot?.downloadConcurrency;
      case 'geometry':
        return snapshot?.geometryWorkers;
      case 'tileEmit':
        return snapshot?.tileWorkers;
      default:
        return undefined;
    }
  })();
  if (threshold == null || currentValue < threshold) return null;
  const ratioText = insight.peakRatio
    ? `peak ${(insight.peakRatio * 100).toFixed(1)}%`
    : 'peak unknown';
  return {
    threshold,
    message: `Last crash suspected in ${normalizedStage} (${ratioText}). Reduce concurrency below ${threshold}.`,
  };
};

export const getBuildConfigSnapshot = (config?: {
  source?: { maxConcurrent?: number };
  geometry?: { maxConcurrent?: number };
  tileEmit?: { maxConcurrent?: number };
}): ShapeBuildConfigSnapshot => ({
  downloadConcurrency: config?.source?.maxConcurrent,
  geometryWorkers: config?.geometry?.maxConcurrent,
  tileWorkers: config?.tileEmit?.maxConcurrent,
});
