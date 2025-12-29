import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NodeType } from '@hierarchidb/common-types';
import { getWorkerBridge, type WorkerBridge } from '@hierarchidb/ui-worker-client';
import type { BatchSessionStatus, ProgressPhase, UnifiedProgressInfo } from '@hierarchidb/common-api';
import { usePluginBatchProgress } from '@hierarchidb/ui-batch';

const ROUTE_NODE_TYPE = 'route' as NodeType;

export interface RouteBatchProgressResult {
  snapshot: UnifiedProgressInfo | null;
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

export function useRouteBatchProgress(nodeId: string | null, _deps?: unknown): RouteBatchProgressResult {
  const bridgeRef = useRef<WorkerBridge>(getWorkerBridge());
  const [status, setStatus] = useState<BatchSessionStatus | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  useEffect(() => {
    if (!nodeId) return;
    void bridgeRef.current.initialize().catch((error: unknown) => {
      console.error('[useRouteBatchProgress] failed to initialize worker bridge', error);
    });
  }, [nodeId]);

  const {
    progress,
    rawStatus,
  } = usePluginBatchProgress<UnifiedProgressInfo, BatchSessionStatus>(
    ROUTE_NODE_TYPE,
    nodeId,
    {
      autoSubscribe: true,
      enablePollingFallback: true,
      mapStatusToUnified: statusToUnified,
      mapUnifiedToProgress: (info) => info ?? null,
      mapUnifiedToStatus: (_info, nextStatus) => nextStatus,
    },
  );

  useEffect(() => {
    if (!rawStatus) return;
    setStatus(rawStatus);
  }, [rawStatus]);

  const [snapshot, setSnapshot] = useState<UnifiedProgressInfo | null>(null);
  useEffect(() => {
    if (!nodeId) {
      setSnapshot(null);
      setStatus(null);
      setMutationError(null);
    }
  }, [nodeId]);
  useEffect(() => {
    if (!progress || !nodeId) return;
    setSnapshot({ ...progress, nodeId });
  }, [nodeId, progress]);

  const pause = useCallback(async () => {
    if (!nodeId || isMutating) return;
    setIsMutating(true);
    setMutationError(null);
    try {
      await bridgeRef.current.pauseBatchSession(ROUTE_NODE_TYPE, nodeId);
      setStatus((prev: BatchSessionStatus | null) => (prev ? { ...prev, status: 'paused', lastActivity: Date.now() } : prev));
    } catch (error: unknown) {
      const message = toErrorMessage(error);
      console.error('[useRouteBatchProgress] pause failed', error);
      setMutationError(message);
    } finally {
      setIsMutating(false);
    }
  }, [isMutating, nodeId]);

  const resume = useCallback(async () => {
    if (!nodeId || isMutating) return;
    setIsMutating(true);
    setMutationError(null);
    try {
      await bridgeRef.current.resumeBatchSession(ROUTE_NODE_TYPE, nodeId);
      setStatus((prev: BatchSessionStatus | null) => (prev ? { ...prev, status: 'running', lastActivity: Date.now() } : prev));
    } catch (error: unknown) {
      const message = toErrorMessage(error);
      console.error('[useRouteBatchProgress] resume failed', error);
      setMutationError(message);
    } finally {
      setIsMutating(false);
    }
  }, [isMutating, nodeId]);

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
  const progress = status.progress ?? {};
  const total = numeric((progress as any).total);
  const completed = numeric((progress as any).completed);
  const failed = numeric((progress as any).failed);
  const phase = mapStatusToPhase(status.status);
  const percentage = computePercentage(phase, total, completed, (progress as any).percentage);
  const meta: Record<string, unknown> = {};
  if (status.error) {
    meta.lastError = status.error;
    meta.errors = [status.error];
  }

  return {
    stage: (progress as any).currentStage ?? 'processing',
    total,
    completed,
    failed,
    percentage,
    currentTask: (progress as any).currentTask ?? (progress as any).currentStage ?? 'processing',
    phase,
    timestamp: status.lastActivity ?? Date.now(),
    payload: {
      total,
      completed,
      failed,
      currentTask: (progress as any).currentTask ?? (progress as any).currentStage ?? 'processing',
      ...(Object.keys(meta).length > 0 ? { meta } : {}),
    },
    message: status.error,
    nodeId: status.nodeId,
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
