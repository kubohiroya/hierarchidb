import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import { type BuildSessionStatus, type BuildUnifiedProgressInfo } from '@hierarchidb/batch-api';
import {
  toBuildSessionStatusFromUnifiedProgress,
  areBuildSessionStatusesEquivalent,
  useBuildSessionMutation,
  usePluginBuildProgress,
} from '@hierarchidb/ui-batch-progress';

const ROUTE_NODE_TYPE = 'route' as NodeType;

export interface RouteBuildProgressResult {
  snapshot: BuildUnifiedProgressInfo | null;
  ready: boolean;
  progress: BuildUnifiedProgressInfo | null;
  status: BuildSessionStatus | null;
  isPaused: boolean;
  isMutating: boolean;
  mutationError: string | null;
  lastError: string | null;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
}
export function useRouteBuildProgress(nodeId: NodeId | null, _deps?: unknown): RouteBuildProgressResult {
  const [status, setStatus] = useState<BuildSessionStatus | null>(null);
  const {
    isMutating,
    mutationError,
    pauseSession,
    resumeSession,
    clearMutationError,
  } = useBuildSessionMutation(ROUTE_NODE_TYPE, nodeId);

  const {
    progress,
  } = usePluginBuildProgress<BuildUnifiedProgressInfo, BuildSessionStatus>(
    ROUTE_NODE_TYPE,
    nodeId,
    {
      autoSubscribe: true,
      mapUnifiedToProgress: (info: BuildUnifiedProgressInfo | null) => info ?? null,
    },
  );

  const mappedStatus = useMemo(() => {
    if (!nodeId) return null;
    return toBuildSessionStatusFromUnifiedProgress({
      nodeId,
      info: progress,
      fallback: status,
    });
  }, [nodeId, progress, status]);

  useEffect(() => {
    if (!mappedStatus) return;
    setStatus((prev: BuildSessionStatus | null) => (
      prev && areBuildSessionStatusesEquivalent(prev, mappedStatus)
        ? prev
        : mappedStatus
    ));
  }, [mappedStatus]);

  const [snapshot, setSnapshot] = useState<BuildUnifiedProgressInfo | null>(null);
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
      setStatus((prev: BuildSessionStatus | null) => (prev ? { ...prev, status: 'paused', lastActivity: Date.now() } : prev));
    }
  }, [nodeId, pauseSession]);

  const resume = useCallback(async () => {
    if (!nodeId) return;
    const succeeded = await resumeSession();
    if (succeeded) {
      setStatus((prev: BuildSessionStatus | null) => (prev ? { ...prev, status: 'running', lastActivity: Date.now() } : prev));
    }
  }, [nodeId, resumeSession]);

  const lastError = useMemo(() => {
    if (mappedStatus?.error) return mappedStatus.error;
    const meta = progress?.payload?.meta;
    const errors = extractErrors(meta);
    if (errors.length > 0) return errors[errors.length - 1] ?? null;
    return progress?.message ?? null;
  }, [mappedStatus?.error, progress?.message, progress?.payload?.meta]);

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

function extractErrors(meta: unknown): string[] {
  if (!meta || typeof meta !== 'object') return [];
  const value = (meta as Record<string, unknown>).errors;
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  const lastError = (meta as Record<string, unknown>).lastError;
  return typeof lastError === 'string' ? [lastError] : [];
}
