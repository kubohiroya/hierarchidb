import { useCallback, useEffect, useRef, useState } from 'react';
import type { NodeId, NodeType } from '@hierarchidb/common-type';
import type {
  BatchProgressEvent,
  BatchSessionStatus,
} from '@hierarchidb/runtime-shared-batch-processor';
import { getWorkerBridge } from '@hierarchidb/runtime-ui-plugin-dialog';
import {
  type ProcessingStatus,
  type ProgressInfo,
} from '../../shared/index.js';
import { useShapeAPIGetter } from './useShapeAPI.js';

type WorkerBridgeLike = ReturnType<typeof getWorkerBridge>;

export interface ShapeProgressState {
  progress: ProgressInfo | null;
  status: ProcessingStatus | null;
  isSubscribed: boolean;
  error: Error | null;
}

export interface UseShapeProgressOptions {
  autoSubscribe?: boolean;
  pollingInterval?: number;
  enablePollingFallback?: boolean;
}

const SHAPE_NODE_TYPE = 'shape' as NodeType;

export function useShapeProgress(
  sessionId: string | null,
  options: UseShapeProgressOptions = {},
): ShapeProgressState & {
  subscribe: () => void;
  unsubscribe: () => void;
  refresh: () => Promise<void>;
} {
  const {
    autoSubscribe = true,
    pollingInterval = 2000,
    enablePollingFallback = true,
  } = options;

  const bridgeRef = useRef<WorkerBridgeLike>(getWorkerBridge());

  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRealTimeActiveRef = useRef(false);

  const handleBatchEvent = useCallback((event: BatchProgressEvent) => {
    const nextProgress = eventToProgress(event);
    const nextStatus = eventToStatus(event);
    setProgress(nextProgress);
    setStatus(nextStatus);

    if (event.error) {
      setError(new Error(renderError(event)));
    } else {
      setError(null);
    }

    isRealTimeActiveRef.current = true;
  }, []);

  const pollProgress = useCallback(async () => {
    if (!sessionId) return;
    try {
      const statusSnapshot = await bridgeRef.current.getBatchSessionStatus(SHAPE_NODE_TYPE, sessionId);
      handleBatchEvent(statusToEvent(statusSnapshot));
    } catch (err) {
      console.warn('[useShapeProgress] poll failed', err);
      setError(err instanceof Error ? err : new Error('Failed to poll progress'));
    }
  }, [sessionId, handleBatchEvent]);

  const subscribe = useCallback(async () => {
    if (!sessionId || isSubscribed) return;

    try {
      setError(null);
      await bridgeRef.current.initialize();
      const unsubscribe = await bridgeRef.current.subscribeBatchProgress(
        SHAPE_NODE_TYPE,
        sessionId,
        (event) => handleBatchEvent(event),
      );
      unsubscribeRef.current = unsubscribe;
      isRealTimeActiveRef.current = true;
      setIsSubscribed(true);
      await pollProgress();
      return;
    } catch (err) {
      console.error('[useShapeProgress] subscribe failed', err);
      if (!enablePollingFallback) {
        setError(err instanceof Error ? err : new Error('Failed to subscribe'));
        return;
      }
    }

    try {
      await pollProgress();
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      pollingRef.current = setInterval(() => {
        void pollProgress();
      }, pollingInterval);
      isRealTimeActiveRef.current = false;
      setIsSubscribed(true);
    } catch (err) {
      console.error('[useShapeProgress] polling fallback failed', err);
      setError(err instanceof Error ? err : new Error('Failed to subscribe'));
    }
  }, [sessionId, isSubscribed, enablePollingFallback, pollingInterval, pollProgress, handleBatchEvent]);

  const unsubscribe = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsSubscribed(false);
    isRealTimeActiveRef.current = false;
  }, []);

  const refresh = useCallback(async () => {
    try {
      await pollProgress();
    } catch (err) {
      console.error('[useShapeProgress] refresh failed', err);
      setError(err instanceof Error ? err : new Error('Failed to refresh progress'));
    }
  }, [pollProgress]);

  useEffect(() => {
    if (sessionId && autoSubscribe) {
      void subscribe();
    }
    return () => {
      unsubscribe();
    };
  }, [sessionId, autoSubscribe, subscribe, unsubscribe]);

  return {
    progress,
    status,
    isSubscribed,
    error,
    subscribe,
    unsubscribe,
    refresh,
  };
}

export function useShapeEntityProgress(
  nodeId: NodeId,
  options: UseShapeProgressOptions = {},
): ShapeProgressState & {
  subscribe: () => void;
  unsubscribe: () => void;
  refresh: () => Promise<void>;
  sessionId: string | null;
} {
  const getShapeAPI = useShapeAPIGetter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [entityError, setEntityError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const api = await getShapeAPI();
        const entity = await api.getEntity(nodeId);
        if (!cancelled) {
          setSessionId(entity?.batchSessionId ?? null);
          setEntityError(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[useShapeEntityProgress] failed to load entity session', err);
          setEntityError(err instanceof Error ? err : new Error('Failed to load entity'));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nodeId, getShapeAPI]);

  const progressHook = useShapeProgress(sessionId, options);

  return {
    ...progressHook,
    sessionId,
    error: progressHook.error ?? entityError,
  };
}

function eventToProgress(event: BatchProgressEvent): ProgressInfo {
  const payload = event.payload ?? {};
  const total = toNumber(payload.total);
  const completed = toNumber(payload.completed);
  const failed = toNumber(payload.failed);
  const skipped = Math.max(0, total - completed - failed);
  const percentage = computePercentage(event.phase, total, completed, payload);

  return {
    total,
    completed,
    failed,
    skipped,
    percentage,
    currentStage: event.stage,
    currentTask: payload.currentTask ?? event.message ?? event.stage,
  };
}

function eventToStatus(event: BatchProgressEvent): ProcessingStatus {
  const payload = event.payload ?? {};
  const total = toNumber(payload.total);
  const completed = toNumber(payload.completed);
  const percentage = computePercentage(event.phase, total, completed, payload);

  return {
    status: phaseToStatus(event.phase),
    stage: event.stage,
    progress: percentage,
    lastUpdated: event.timestamp ?? Date.now(),
    hasErrors: Boolean(event.error),
    errorMessages: event.error ? [renderError(event)] : [],
    error: event.error ? renderError(event) : undefined,
  };
}

function statusToEvent(status: BatchSessionStatus): BatchProgressEvent {
  const progress = status.progress ?? {
    total: 0,
    completed: 0,
    failed: 0,
  };
  const phase = mapStatusToPhase(status.status);
  return {
    sessionId: status.sessionId,
    nodeId: status.nodeId,
    stage: progress.currentStage ?? 'processing',
    phase,
    timestamp: Date.now(),
    payload: {
      total: progress.total,
      completed: progress.completed,
      failed: progress.failed,
      currentTask: progress.currentTask,
    },
    message: status.error,
    error: status.error ? { detail: status.error } : undefined,
  } satisfies BatchProgressEvent;
}

function computePercentage(
  phase: BatchProgressEvent['phase'] | undefined,
  total: number,
  completed: number,
  payload: Record<string, unknown>,
): number {
  if (phase === 'completed') return 100;
  const supplied = typeof payload.percentage === 'number' ? payload.percentage : undefined;
  if (typeof supplied === 'number' && Number.isFinite(supplied)) {
    return supplied;
  }
  if (total > 0) {
    return Math.max(0, Math.min(100, Math.round((completed / total) * 100)));
  }
  return 0;
}

function phaseToStatus(phase: BatchProgressEvent['phase'] | undefined): ProcessingStatus['status'] {
  switch (phase) {
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    case 'queued':
      return 'idle';
    default:
      return 'processing';
  }
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

function renderError(event: BatchProgressEvent): string {
  if (!event.error) return 'Unknown error';
  const detail = typeof event.error === 'object' ? (event.error.detail ?? event.error.code) : event.error;
  return typeof detail === 'string' ? detail : 'Unknown error';
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
