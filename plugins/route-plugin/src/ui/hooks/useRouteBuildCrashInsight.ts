import { useMemo } from 'react';
import type { RouteEntity } from '../../common/entities/RouteEntity.js';
import {
  getBuildMonitorKey,
  loadBuildMonitor,
  getCrashInsight,
  type CrashInsight,
} from '../utils/buildMonitor.js';

type Args = {
  draft?: Partial<RouteEntity> | null;
  nodeId?: string | null;
};

export const useRouteBuildCrashInsight = ({ draft, nodeId }: Args): CrashInsight | null => {
  const key = useMemo(
    () => getBuildMonitorKey(nodeId ?? null),
    [nodeId],
  );
  const record = useMemo(() => {
    if (!key) return null;
    return loadBuildMonitor(key);
  }, [key, draft?.buildStartedAt, draft?.buildFinishedAt, draft?.processingStatus]);
  return useMemo(() => (
    getCrashInsight(record, draft?.processingStatus ?? null)
  ), [draft?.processingStatus, record]);
};
