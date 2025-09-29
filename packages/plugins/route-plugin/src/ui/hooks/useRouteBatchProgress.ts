import { useEffect, useMemo, useRef, useState } from 'react';
import type { NodeType } from '@hierarchidb/common-type';
import type {
  BatchProgressEvent,
  BatchSessionStatus,
} from '@hierarchidb/runtime-shared-batch-processor';
import { createAdapterFromProgressSubscribe, useBatchProgress } from '@hierarchidb/ui-core';
import { getWorkerBridge } from '@hierarchidb/runtime-ui-plugin-dialog';
import type { UnifiedProgressInfo } from '@hierarchidb/ui-core';

const ROUTE_NODE_TYPE = 'route' as NodeType;

type RouteProgressSnapshot = {
  jobId: string;
  progress: number;
  phase: string;
};

export interface RouteBatchProgressResult {
  snapshot: RouteProgressSnapshot | undefined;
  ready: boolean;
  progress: UnifiedProgressInfo | null;
}

export function useRouteBatchProgress(jobId: string | null, _deps?: unknown): RouteBatchProgressResult {
  const bridgeRef = useRef(getWorkerBridge());

  useEffect(() => {
    if (!jobId) return;
    void bridgeRef.current.initialize().catch((error) => {
      console.error('[useRouteBatchProgress] failed to initialize worker bridge', error);
    });
  }, [jobId]);

  const adapter = useMemo(() => {
    if (!jobId) return null;
    return createAdapterFromProgressSubscribe((cb) =>
      bridgeRef.current
        .subscribeBatchProgress(ROUTE_NODE_TYPE, jobId, (event) => cb(progressEventToUnified(event)))
        .catch((error) => {
          console.error('[useRouteBatchProgress] subscribe failed', error);
          throw error;
        }),
    );
  }, [jobId]);

  const poll = useMemo(() => {
    if (!jobId) return undefined;
    return async (): Promise<UnifiedProgressInfo | null> => {
      try {
        const status = await bridgeRef.current.getBatchSessionStatus(ROUTE_NODE_TYPE, jobId);
        return statusToUnified(status);
      } catch (error) {
        console.warn('[useRouteBatchProgress] poll failed', error);
        return null;
      }
    };
  }, [jobId]);

  const { progress } = useBatchProgress(adapter, { autoSubscribe: true, poll });

  const [snapshot, setSnapshot] = useState<RouteProgressSnapshot | undefined>();
  useEffect(() => {
    if (!progress || !jobId) return;
    setSnapshot({
      jobId,
      progress: Math.round(progress.percentage ?? 0),
      phase: progress.stage ?? progress.phase ?? 'processing',
    });
  }, [progress, jobId]);

  return {
    snapshot,
    ready: progress != null,
    progress,
  };
}

function progressEventToUnified(event: BatchProgressEvent): UnifiedProgressInfo {
  const payload = event.payload ?? {};
  const total = numeric(payload.total);
  const completed = numeric(payload.completed);
  const failed = numeric(payload.failed);
  const percentage = computePercentage(event.phase, total, completed);

  return {
    stage: event.stage,
    total,
    completed,
    failed,
    percentage,
    currentTask: payload.currentTask ?? event.message ?? event.stage,
    phase: event.phase,
    timestamp: event.timestamp,
    payload,
    message: event.message,
    nodeId: event.nodeId,
    sessionId: event.sessionId,
  };
}

function statusToUnified(status: BatchSessionStatus): UnifiedProgressInfo {
  const total = numeric(status.progress.total);
  const completed = numeric(status.progress.completed);
  const failed = numeric(status.progress.failed);
  const phase = mapStatusToPhase(status.status);
  const percentage = computePercentage(phase, total, completed, status.progress.percentage);

  return {
    stage: status.progress.currentStage ?? 'processing',
    total,
    completed,
    failed,
    percentage,
    currentTask: status.progress.currentTask ?? status.progress.currentStage ?? 'processing',
    phase,
    timestamp: status.lastActivity ?? Date.now(),
    payload: {
      total,
      completed,
      failed,
      currentTask: status.progress.currentTask ?? status.progress.currentStage ?? 'processing',
    },
    message: status.error,
    nodeId: status.nodeId,
    sessionId: status.sessionId,
  };
}

function numeric(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function computePercentage(
  phase: string | undefined,
  total: number,
  completed: number,
  provided?: number,
): number {
  if (phase === 'completed') return 100;
  if (typeof provided === 'number' && Number.isFinite(provided)) return provided;
  if (total > 0) {
    return Math.max(0, Math.min(100, Math.round((completed / total) * 100)));
  }
  return 0;
}

function mapStatusToPhase(status: BatchSessionStatus['status']): BatchProgressEvent['phase'] {
  switch (status) {
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    case 'paused':
      return 'paused';
    case 'idle':
      return 'queued';
    default:
      return 'running';
  }
}
