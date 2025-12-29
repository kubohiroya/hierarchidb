import { useMemo } from 'react';
import type { RouteEntity } from '../../common/entities/RouteEntity.js';
import {
  type BuildMonitorConfig,
  getBuildMonitorKey,
  loadBuildMonitor,
  getCrashInsight,
  type CrashInsight,
} from '@hierarchidb/ui-monitoring';

type Args = {
  draft?: Partial<RouteEntity> | null;
  nodeId?: string | null;
};

const buildMonitorConfig: BuildMonitorConfig = {
  storagePrefix: 'hdb:route:build-monitor',
  maxSamples: 3,
  memoryPressureRatio: 0.85,
};

export const useRouteBuildCrashInsight = ({ draft, nodeId }: Args): CrashInsight | null => {
  const key = useMemo(
    () => getBuildMonitorKey(buildMonitorConfig, nodeId ?? null),
    [nodeId],
  );
  const record = useMemo(() => {
    if (!key) return null;
    return loadBuildMonitor(buildMonitorConfig, key);
  }, [key, draft?.buildStartedAt, draft?.buildFinishedAt, draft?.processingStatus]);
  return useMemo(() => (
    getCrashInsight(buildMonitorConfig, record, draft?.processingStatus ?? null)
  ), [draft?.processingStatus, record]);
};
