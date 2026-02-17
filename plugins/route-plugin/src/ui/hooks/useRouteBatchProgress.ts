import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { type BatchSessionStatus, type ProgressPhase, type UnifiedProgressInfo } from '@hierarchidb/batch-api';
import { useBatchSessionMutation, usePluginBatchProgress } from '@hierarchidb/ui-batch-progress';

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

export function useRouteBatchProgress(nodeId: NodeId | null, _deps?: unknown): RouteBatchProgressResult {
  const [status, setStatus] = useState<BatchSessionStatus | null>(null);
  const {
    isMutating,
    mutationError,
    pauseSession,
    resumeSession,
    clearMutationError,
  } = useBatchSessionMutation(ROUTE_NODE_TYPE, nodeId);

  const {
    progress,
    status: derivedStatus,
  } = usePluginBatchProgress<UnifiedProgressInfo, BatchSessionStatus>(
    ROUTE_NODE_TYPE,
    nodeId,
    {
      autoSubscribe: true,
      mapUnifiedToProgress: (info) => info ?? null,
      mapUnifiedToStatus: (info) => (nodeId && info ? toBatchSessionStatus(nodeId, info) : null),
    },
  );

  useEffect(() => {
    if (!derivedStatus) return;
    setStatus(derivedStatus);
  }, [derivedStatus]);

  const [snapshot, setSnapshot] = useState<UnifiedProgressInfo | null>(null);
  useEffect(() => {
    if (!nodeId) {
      setSnapshot(null);
      setStatus(null);
      clearMutationError();
    }
  }, [clearMutationError, nodeId]);
  useEffect(() => {
    if (!progress || !nodeId) return;
    setSnapshot({ ...progress, nodeId });
  }, [nodeId, progress]);

  const pause = useCallback(async () => {
    if (!nodeId) return;
    const succeeded = await pauseSession();
    if (succeeded) {
      setStatus((prev: BatchSessionStatus | null) => (prev ? { ...prev, status: 'paused', lastActivity: Date.now() } : prev));
    }
  }, [nodeId, pauseSession]);

  const resume = useCallback(async () => {
    if (!nodeId) return;
    const succeeded = await resumeSession();
    if (succeeded) {
      setStatus((prev: BatchSessionStatus | null) => (prev ? { ...prev, status: 'running', lastActivity: Date.now() } : prev));
    }
  }, [nodeId, resumeSession]);

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

function toBatchSessionStatus(nodeId: NodeId, info: UnifiedProgressInfo): BatchSessionStatus {
  const phase = info.phase as ProgressPhase | undefined;
  return {
    nodeId,
    status: phase ?? 'idle',
    progress: {
      total: info.total ?? 0,
      completed: info.completed ?? 0,
      failed: info.failed ?? 0,
      skipped: typeof info.payload?.skipped === 'number' ? info.payload?.skipped : undefined,
      percentage: typeof info.percentage === 'number' ? info.percentage : 0,
      taskType: info.stage,
    },
    lastActivity: typeof info.timestamp === 'number' ? info.timestamp : Date.now(),
    error: typeof info.message === 'string' ? info.message : undefined,
  };
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
