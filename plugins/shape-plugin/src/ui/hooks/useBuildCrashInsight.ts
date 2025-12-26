import { useMemo } from 'react';
import type { ShapeEntity } from '../../common/types/index.js';
import {
  getBuildMonitorKey,
  loadBuildMonitor,
  getCrashInsight,
  type CrashInsight,
} from '../utils/buildMonitor.js';

type Args = {
  draft?: Partial<ShapeEntity> | null;
  nodeId?: string | null;
};

export const useBuildCrashInsight = ({ draft, nodeId }: Args): CrashInsight | null => {
  const sessionId = draft?.batchSessionId ?? draft?.nodeId ?? null;
  const key = useMemo(
    () => getBuildMonitorKey(nodeId ?? (draft?.nodeId ?? null), sessionId),
    [draft?.nodeId, nodeId, sessionId],
  );
  const record = useMemo(() => {
    if (!key) return null;
    return loadBuildMonitor(key);
  }, [key, draft?.buildStartedAt, draft?.buildFinishedAt, draft?.processingStatus]);
  return useMemo(() => (
    getCrashInsight(record, draft?.processingStatus ?? null)
  ), [draft?.processingStatus, record]);
};
