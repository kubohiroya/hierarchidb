import type { RouteEntity } from '@hierarchidb/route-api';
import type { BuildStatus } from '@hierarchidb/ui-build-progress';
import {
  type BuildMonitorConfig,
  type CrashInsight,
  getBuildMonitorKey,
  getCrashInsight,
  loadBuildMonitor,
} from '@hierarchidb/ui-monitoring';
import { useMemo } from 'react';

type Args = {
  draft?: Partial<RouteEntity> | null;
  nodeId?: string | null;
  sessionStatus?: BuildStatus;
};

const buildMonitorConfig: BuildMonitorConfig = {
  storagePrefix: 'hdb:route:stage-monitor',
  maxSamples: 3,
  memoryPressureRatio: 0.85,
};

export const useRouteBuildCrashInsight = ({
  draft,
  nodeId,
  sessionStatus,
}: Args): CrashInsight | null => {
  const key = useMemo(() => getBuildMonitorKey(buildMonitorConfig, nodeId ?? null), [nodeId]);
  const record = useMemo(() => (key ? loadBuildMonitor(buildMonitorConfig, key) : null), [key]);
  const processingStatus = useMemo(() => {
    if (sessionStatus === 'running') return 'processing';
    if (sessionStatus === 'paused') return 'paused';
    return draft?.processingStatus ?? null;
  }, [draft?.processingStatus, sessionStatus]);
  const insight = useMemo(
    () => getCrashInsight(buildMonitorConfig, record, processingStatus),
    [processingStatus, record]
  );
  return sessionStatus === 'completed' ? null : insight;
};
