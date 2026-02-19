import { useMemo } from 'react';
import type { ShapeEntity } from '~/common/types/index';
import type { BuildStatus } from '@hierarchidb/components/build-status';
import {
  type BuildMonitorConfig,
  getBuildMonitorKey,
  loadBuildMonitor,
  getCrashInsight,
  type CrashInsight,
} from '@hierarchidb/ui-monitoring';
import type { ShapeBuildConfigSnapshot, ShapeBuildStage } from '~/ui/utils/buildWarnings';

type Args = {
  draft?: Partial<ShapeEntity> | null;
  nodeId?: string | null;
  status?: BuildStatus | null;
};

const buildMonitorConfig: BuildMonitorConfig = {
  storagePrefix: 'hdb:shape:stage-monitor',
  maxSamples: 3,
  memoryPressureRatio: 0.85,
  heapWarningRatio: 0.85,
  heapCriticalRatio: 0.9,
};

export const useBuildCrashInsight = (
  { draft, nodeId, status }: Args,
): CrashInsight<ShapeBuildStage, ShapeBuildConfigSnapshot> | null => {
  const key = useMemo(
    () => getBuildMonitorKey(buildMonitorConfig, nodeId ?? null),
    [nodeId],
  );
  const record = useMemo(() => {
    if (!key) return null;
    return loadBuildMonitor<ShapeBuildStage, ShapeBuildConfigSnapshot>(buildMonitorConfig, key);
  }, [key]);
  const normalizedStatus = useMemo(() => {
    if (status === 'running') return 'processing';
    if (status === 'idle' || status === 'paused' || status === 'completed' || status === 'failed') {
      return status;
    }
    return draft?.processingStatus ?? null;
  }, [draft?.processingStatus, status]);
  return useMemo(() => (
    getCrashInsight(buildMonitorConfig, record, normalizedStatus)
  ), [normalizedStatus, record]);
};
