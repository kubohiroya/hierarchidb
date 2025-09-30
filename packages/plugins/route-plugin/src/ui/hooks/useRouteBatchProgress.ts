import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeType } from '@hierarchidb/common-type';
import type { BatchSessionStatus, ProgressPhase } from '@hierarchidb/runtime-shared-batch-processor';
import { createAdapterFromProgressSubscribe, useBatchProgress } from '@hierarchidb/ui-core';
import { getWorkerBridge, type WorkerBridge } from '@hierarchidb/runtime-ui-plugin-dialog';
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
  status: BatchSessionStatus | null;
  isPaused: boolean;
  isMutating: boolean;
  mutationError: string | null;
  lastError: string | null;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
}

export function useRouteBatchProgress(jobId: string | null, _deps?: unknown): RouteBatchProgressResult {
  const bridgeRef = useRef<WorkerBridge>(getWorkerBridge());
  const [status, setStatus] = useState<BatchSessionStatus | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    void bridgeRef.current.initialize().catch((error: unknown) => {
      console.error('[useRouteBatchProgress] failed to initialize worker bridge', error);
    });
  }, [jobId]);

  const adapter = useMemo(() => {
    if (!jobId) return null;
    return createAdapterFromProgressSubscribe((cb) => bridgeRef.current.subscribeBatchProgress(
      ROUTE_NODE_TYPE,
      jobId,
      cb,
    ));
  }, [jobId]);

  const poll = useMemo(() => {
    if (!jobId) return undefined;
    return async (): Promise<UnifiedProgressInfo | null> => {
      try {
        const nextStatus = await bridgeRef.current.getBatchSessionStatus(ROUTE_NODE_TYPE, jobId);
        setStatus(nextStatus);
        return statusToUnified(nextStatus);
      } catch (error: unknown) {
        console.warn('[useRouteBatchProgress] poll failed', error);
        return null;
      }
    };
  }, [jobId]);

  const { progress } = useBatchProgress(adapter, { autoSubscribe: true, poll });

  const [snapshot, setSnapshot] = useState<RouteProgressSnapshot | undefined>();
  useEffect(() => {
    if (!jobId) {
      setSnapshot(undefined);
      setStatus(null);
      setMutationError(null);
    }
  }, [jobId]);
  useEffect(() => {
    if (!progress || !jobId) return;
    setSnapshot({
      jobId,
      progress: Math.round(progress.percentage ?? 0),
      phase: progress.stage ?? progress.phase ?? 'processing',
    });
  }, [progress, jobId]);

  const pause = useCallback(async () => {
    if (!jobId || isMutating) return;
    setIsMutating(true);
    setMutationError(null);
    try {
      await bridgeRef.current.pauseBatchSession(ROUTE_NODE_TYPE, jobId);
      setStatus((prev) => (prev ? { ...prev, status: 'paused', lastActivity: Date.now() } : prev));
    } catch (error: unknown) {
      const message = toErrorMessage(error);
      console.error('[useRouteBatchProgress] pause failed', error);
      setMutationError(message);
    } finally {
      setIsMutating(false);
    }
  }, [isMutating, jobId]);

  const resume = useCallback(async () => {
    if (!jobId || isMutating) return;
    setIsMutating(true);
    setMutationError(null);
    try {
      await bridgeRef.current.resumeBatchSession(ROUTE_NODE_TYPE, jobId);
      setStatus((prev) => (prev ? { ...prev, status: 'running', lastActivity: Date.now() } : prev));
    } catch (error: unknown) {
      const message = toErrorMessage(error);
      console.error('[useRouteBatchProgress] resume failed', error);
      setMutationError(message);
    } finally {
      setIsMutating(false);
    }
  }, [isMutating, jobId]);

  const lastError = useMemo(() => {
    if (status?.error) return status.error;
    const meta = progress?.payload?.meta;
    const errors = extractErrors(meta);
    if (errors.length > 0) return errors[errors.length - 1] ?? null;
    return progress?.message ?? null;
  }, [progress?.message, progress?.payload?.meta, status?.error]);

  return {
    snapshot,
    ready: progress != null,
    progress,
    status,
    isPaused: status?.status === 'paused',
    isMutating,
    mutationError,
    lastError,
    pause,
    resume,
  };
}

function statusToUnified(status: BatchSessionStatus): UnifiedProgressInfo {
  const total = numeric(status.progress.total);
  const completed = numeric(status.progress.completed);
  const failed = numeric(status.progress.failed);
  const phase = mapStatusToPhase(status.status);
  const percentage = computePercentage(phase, total, completed, status.progress.percentage);
  const meta: Record<string, unknown> = {};
  if (status.error) {
    meta.lastError = status.error;
    meta.errors = [status.error];
  }

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
      ...(Object.keys(meta).length > 0 ? { meta } : {}),
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

function mapStatusToPhase(status: BatchSessionStatus['status']): ProgressPhase {
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

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

function extractErrors(meta: unknown): string[] {
  if (!meta || typeof meta !== 'object') return [];
  const value = (meta as Record<string, unknown>).errors;
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  const lastError = (meta as Record<string, unknown>).lastError;
  return typeof lastError === 'string' ? [lastError] : [];
}
