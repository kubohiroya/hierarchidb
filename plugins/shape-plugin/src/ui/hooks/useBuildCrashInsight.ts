import { useMemo } from 'react';
import type { ShapeEntity } from '../../common/types/index.js';
import {
  type BuildMonitorConfig,
  getBuildMonitorKey,
  loadBuildMonitor,
  getCrashInsight,
  type CrashInsight,
} from '@hierarchidb/ui-monitoring';
import type { ShapeBuildConfigSnapshot, ShapeBuildStage } from '../utils/buildWarnings.js';

type Args = {
  draft?: Partial<ShapeEntity> | null;
  nodeId?: string | null;
};

const buildMonitorConfig: BuildMonitorConfig = {
  storagePrefix: 'hdb:shape:stage-monitor',
  maxSamples: 3,
  memoryPressureRatio: 0.85,
  heapWarningRatio: 0.85,
  heapCriticalRatio: 0.9,
};

export const useBuildCrashInsight = (
  { draft, nodeId }: Args,
): CrashInsight<ShapeBuildStage, ShapeBuildConfigSnapshot> | null => {
  const key = useMemo(
    () => getBuildMonitorKey(buildMonitorConfig, nodeId ?? (draft?.nodeId ?? null)),
    [draft?.nodeId, nodeId],
  );
  const record = useMemo(() => {
    if (!key) return null;
    return loadBuildMonitor<ShapeBuildStage, ShapeBuildConfigSnapshot>(buildMonitorConfig, key);
  }, [key, draft?.buildStartedAt, draft?.buildFinishedAt, draft?.processingStatus]);
  return useMemo(() => (
    getCrashInsight(buildMonitorConfig, record, draft?.processingStatus ?? null)
  ), [draft?.processingStatus, record, draft?.buildStartedAt, draft?.buildFinishedAt, draft?.processingStatus]);
};
