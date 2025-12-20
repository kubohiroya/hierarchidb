import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeType } from '@hierarchidb/common-types';
import type {
  BatchProgressPayload,
  BatchSessionStatus,
  UnifiedProgressInfo,
} from '@hierarchidb/common-api';
import { useBatchProgress, createAdapterFromProgressSubscribe } from '@hierarchidb/batch';
import { getWorkerBridge, type WorkerBridge } from '@hierarchidb/ui-worker-client';

export interface ShapeProgress {
  total: number;
  completed: number;
  failed: number;
  skipped: number;
  percentage: number;
  currentStage?: string;
  currentTask?: string;
  timestamp?: number;
  message?: string | null;
}

export interface ShapeProgressStatus {
  status: 'processing' | 'completed' | 'failed' | 'cancelled' | 'paused' | 'queued';
  stage?: string;
  progress?: number;
  hasErrors?: boolean;
  error?: string | null;
  lastUpdated?: number;
}

export interface ShapeProgressState {
  progress: ShapeProgress | null;
  status: ShapeProgressStatus | null;
  isSubscribed: boolean;
  error: Error | null;
}

export interface UseShapeProgressOptions {
  autoSubscribe?: boolean;
  enablePollingFallback?: boolean;
}

const SHAPE_NODE_TYPE = 'shape' as NodeType;

type ExtendedPayload = BatchProgressPayload & { stage?: string; currentTask?: string };

type ExtendedProgress = UnifiedProgressInfo & {
  phase?: string;
  timestamp?: number;
  message?: string | null;
  payload?: ExtendedPayload;
};

function toShapeProgress(info: ExtendedProgress | null, sessionId?: string): ShapeProgress | null {
  if (!info) return null;
  const total = info.total ?? info.payload?.total ?? 0;
  const completed = info.completed ?? info.payload?.completed ?? 0;
  const failed = info.failed ?? info.payload?.failed ?? 0;
  const skipped = info.payload?.skipped ?? Math.max(total - completed - failed, 0);
  const percentage = typeof info.percentage === 'number' && Number.isFinite(info.percentage)
    ? info.percentage
    : total > 0
      ? Math.max(0, Math.min(100, Math.round((completed / total) * 100)))
      : 0;
  return {
    total,
    completed,
    failed,
    skipped,
    percentage,
    currentStage: info.stage ?? info.phase ?? info.payload?.stage ?? 'processing',
    currentTask: info.currentTask ?? info.message ?? info.payload?.currentTask ?? sessionId ?? 'shape',
    timestamp: typeof info.timestamp === 'number' ? info.timestamp : Date.now(),
    message: info.message ?? undefined,
  };
}

function toStatus(info: ExtendedProgress | null, fallback?: BatchSessionStatus | null): ShapeProgressStatus | null {
  const phase = info?.phase ?? fallback?.status;
  if (!phase) return null;
  const status = mapPhaseToStatus(phase);
  const error = fallback?.error ?? info?.message ?? null;
  const progress = info?.percentage ?? fallback?.progress?.percentage;
  const hasErrors = status === 'failed' || Boolean(error);
  return {
    status,
    stage: info?.stage ?? info?.payload?.stage ?? fallback?.progress?.currentStage,
    progress: typeof progress === 'number' ? progress : undefined,
    hasErrors,
    error,
    lastUpdated: info?.timestamp ?? fallback?.lastActivity ?? Date.now(),
  };
}

function mapPhaseToStatus(phase: string): ShapeProgressStatus['status'] {
  switch (phase) {
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    case 'paused':
      return 'paused';
    case 'queued':
      return 'queued';
    default:
      return 'processing';
  }
}

function statusToUnified(status: BatchSessionStatus): UnifiedProgressInfo {
  const progress = status.progress;
  const total = numeric(progress.total);
  const completed = numeric(progress.completed);
  const failed = numeric(progress.failed);
  const percentage = numeric(progress.percentage, total > 0 ? Math.round((completed / total) * 100) : 0);
  return {
    stage: progress.currentStage ?? 'processing',
    total,
    completed,
    failed,
    percentage,
    currentTask: progress.currentTask ?? progress.currentStage ?? 'processing',
    phase: mapPhaseToStatus(status.status),
    timestamp: status.lastActivity ?? Date.now(),
    payload: {
      total,
      completed,
      failed,
      currentTask: progress.currentTask ?? progress.currentStage ?? 'processing',
      meta: status.error ? { errors: [status.error] } : undefined,
    },
    message: status.error,
    nodeId: status.nodeId,
    sessionId: status.sessionId,
  };
}

function numeric(value: number | undefined, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return fallback;
}

export function useShapeProgress(
  sessionId: string | null,
  options: UseShapeProgressOptions = {},
): ShapeProgressState & { subscribe: () => void; unsubscribe: () => void } {
  const {
    autoSubscribe = true,
    enablePollingFallback = true,
  } = options;

  const bridgeRef = useRef<WorkerBridge>(getWorkerBridge());
  const [error, setError] = useState<Error | null>(null);
  const [status, setStatus] = useState<BatchSessionStatus | null>(null);

  useEffect(() => {
    if (!sessionId || !autoSubscribe) return;
    void bridgeRef.current.initialize().catch((err: unknown) => {
      const errObj = err instanceof Error ? err : new Error(String(err));
      setError(errObj);
    });
  }, [autoSubscribe, sessionId]);

  useEffect(() => {
    setStatus(null);
    setError(null);
  }, [sessionId]);

  const adapter = useMemo(() => {
    if (!sessionId) return null;
    return createAdapterFromProgressSubscribe((eventCallback) =>
      bridgeRef.current
        .subscribeBatchProgress(SHAPE_NODE_TYPE, sessionId, eventCallback)
        .then((unsubscribe: () => void) => {
          setError(null);
          return unsubscribe;
        })
        .catch((err: unknown) => {
          const errObj = err instanceof Error ? err : new Error('Failed to subscribe to shape batch progress');
          setError(errObj);
          return () => {};
        }),
    );
  }, [sessionId]);

  const poll = useMemo(() => {
    if (!sessionId || !enablePollingFallback) return undefined;
    return async (): Promise<UnifiedProgressInfo | null> => {
      try {
        const nextStatus = await bridgeRef.current.getBatchSessionStatus(SHAPE_NODE_TYPE, sessionId);
        setStatus(nextStatus);
        return statusToUnified(nextStatus);
      } catch (err: unknown) {
        const errObj = err instanceof Error ? err : new Error('Failed to fetch shape batch status');
        setError(errObj);
        return null;
      }
    };
  }, [enablePollingFallback, sessionId]);

  const {
    progress: unifiedProgress,
    subscribed,
    subscribe: sharedSubscribe,
    unsubscribe: sharedUnsubscribe,
  } = useBatchProgress(adapter, { autoSubscribe, poll });

  const subscribe = useCallback(() => {
    void bridgeRef.current.initialize().catch((err: unknown) => {
      const errObj = err instanceof Error ? err : new Error(String(err));
      setError(errObj);
    });
    sharedSubscribe();
  }, [sharedSubscribe]);

  const unsubscribe = useCallback(() => {
    sharedUnsubscribe();
  }, [sharedUnsubscribe]);

  const progress = toShapeProgress(unifiedProgress as ExtendedProgress | null, sessionId ?? undefined);
  const derivedStatus = toStatus(unifiedProgress as ExtendedProgress | null, status);

  return {
    progress,
    status: derivedStatus,
    isSubscribed: subscribed,
    error,
    subscribe,
    unsubscribe,
  };
}
