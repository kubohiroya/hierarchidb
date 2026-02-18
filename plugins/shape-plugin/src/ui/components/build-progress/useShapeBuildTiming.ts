import { useEffect } from 'react';
import type { NodeId } from '@hierarchidb/core-types';
import type { BuildStatus } from '@hierarchidb/components/build-status';
import type { ShapeBuildSessionRecord } from '@hierarchidb/shape-api';
import {
  appendBuildSample,
  BUILD_MONITOR_SAMPLE_INTERVAL_MS,
  getMemorySnapshot,
  recordBuildFinish,
  recordBuildStart,
} from '@hierarchidb/ui-monitoring';
import { useBuildSessionTiming } from '@hierarchidb/batch-runtime-services';
import { shapeMutationAPIImpl, shapeQueryAPIImpl } from '../../../services/batch/ShapeBuildAPIClient.ts';

const buildMonitorConfig = {
  storagePrefix: 'hdb:shape:stage-monitor',
  maxSamples: 3,
  memoryPressureRatio: 0.85,
  heapWarningRatio: 0.85,
  heapCriticalRatio: 0.9,
} as const;

const HEARTBEAT_INTERVAL_MS = 1000;
const HEARTBEAT_PERSIST_MS = 5000;
const INACTIVE_GRACE_MS = 5000;

type Args = {
  buildStatus: BuildStatus;
  taskType?: string;
  resolvedTaskType?: string;
  nodeId?: NodeId;
  monitorKey: string | null;
  canWrite: boolean;
};

export const useShapeBuildTiming = ({
  buildStatus,
  taskType,
  resolvedTaskType,
  nodeId,
  monitorKey,
  canWrite,
}: Args) => {
  const { timingSnapshot, session } = useBuildSessionTiming<ShapeBuildSessionRecord>({
    buildStatus,
    resolvedTaskType,
    sessionId: nodeId,
    getSessionRecord: shapeQueryAPIImpl.getBuildSessionRecord,
    updateSession: shapeMutationAPIImpl.updateBuildSession,
    canWrite,
    heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
    heartbeatPersistMs: HEARTBEAT_PERSIST_MS,
    inactiveGraceMs: INACTIVE_GRACE_MS,
  });

  useEffect(() => {
    if (!monitorKey) return;
    if (!canWrite) return;
    if (buildStatus !== 'running') return;
    const startedAt = session?.startedAt ?? Date.now();
    recordBuildStart(buildMonitorConfig, monitorKey, {
      nodeId: nodeId ? String(nodeId) : undefined,
      startedAt,
    });
    const interval = window.setInterval(() => {
      appendBuildSample(buildMonitorConfig, monitorKey, {
        timestamp: Date.now(),
        stage: taskType as 'fetch' | 'transform' | 'vt' | undefined,
        ...getMemorySnapshot(),
      });
    }, BUILD_MONITOR_SAMPLE_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
    };
  }, [buildStatus, canWrite, monitorKey, nodeId, taskType]);

  useEffect(() => {
    if (!monitorKey) return;
    if (!canWrite) return;
    if (!['completed', 'failed'].includes(buildStatus)) return;
    recordBuildFinish(buildMonitorConfig, monitorKey, Date.now());
  }, [buildStatus, canWrite, monitorKey]);

  return {
    timingSnapshot,
    session,
  };
};
