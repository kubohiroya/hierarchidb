import { useEffect, useState } from 'react';
import type { NodeType, ProgressEvent } from '@hierarchidb/common-types';
import type { BatchSessionStatus, UnifiedProgressInfo } from '@hierarchidb/common-api';
import { AuthNotificationRegistry } from '@hierarchidb/common-auth';
import { usePluginBatchProgress } from '@hierarchidb/ui-batch';

export interface UseLocationProgressOptions {
  autoSubscribe?: boolean;
}

export interface LocationProgressEvent extends ProgressEvent {
  message?: string;
}

export interface UseLocationProgressState {
  progress: LocationProgressEvent | null;
  unifiedProgress: UnifiedProgressInfo | null;
  isSubscribed: boolean;
  error: Error | null;
}

const LOCATION_NODE_TYPE = 'location' as NodeType;

type ExtendedProgressInfo = UnifiedProgressInfo & {
  phase?: string;
  timestamp?: number;
  message?: string;
  nodeId?: string;
};

const statusToUnified = (status: BatchSessionStatus): UnifiedProgressInfo => {
  const progress = status.progress ?? {};
  const total = progress.total ?? 0;
  const completed = progress.completed ?? 0;
  const failed = progress.failed ?? 0;
  const percentage = progress.percentage
    ?? (total > 0 ? Math.max(0, Math.min(100, Math.round((completed / total) * 100))) : 0);
  const stage = progress.currentStage ?? 'processing';
  return {
    stage,
    total,
    completed,
    failed,
    percentage,
    currentTask: progress.currentTask ?? stage,
    phase: status.status,
    timestamp: status.lastActivity ?? Date.now(),
    payload: {
      total,
      completed,
      failed,
      currentTask: progress.currentTask ?? stage,
      meta: status.error ? { errors: [status.error] } : undefined,
    },
    message: status.error,
    nodeId: status.nodeId,
  };
};

function toProgressEvent(
  info: ExtendedProgressInfo | null,
  fallbackNodeId?: string,
): LocationProgressEvent | null {
  if (!info) return null;
  const nodeId = (info.nodeId as string | undefined) ?? fallbackNodeId ?? 'location';
  const stage = info.phase === 'completed' ? 'completed' : info.stage;
  const event: LocationProgressEvent = {
    nodeId,
    stage,
    total: info.total ?? 0,
    completed: info.completed ?? 0,
    failed: info.failed ?? 0,
    percentage: info.percentage ?? 0,
    currentTask: info.currentTask ?? info.message ?? stage,
    timestamp: typeof info.timestamp === 'number' ? info.timestamp : Date.now(),
    message: info.message,
  };
  return event;
}

/**
 * useLocationProgress - Subscribe to Location batch progress events via WorkerBridge.
 */
export function useLocationProgress(
  nodeId: string | null,
  options: UseLocationProgressOptions = {},
): UseLocationProgressState & { subscribe: () => void; unsubscribe: () => void } {
  const { autoSubscribe = true } = options;
  const [overrideProgress, setOverrideProgress] = useState<LocationProgressEvent | null>(null);
  const {
    progress: derivedProgress,
    unifiedProgress,
    isSubscribed,
    error,
    subscribe,
    unsubscribe,
  } = usePluginBatchProgress<LocationProgressEvent>(
    LOCATION_NODE_TYPE,
    nodeId,
    {
      autoSubscribe,
      enablePollingFallback: false,
      mapStatusToUnified: statusToUnified,
      mapUnifiedToProgress: (info: UnifiedProgressInfo | null, id?: string) =>
        toProgressEvent(info as ExtendedProgressInfo | null, id),
    },
  );

  useEffect(() => {
    setOverrideProgress(null);
  }, [nodeId]);

  useEffect(() => {
    if (unifiedProgress) {
      setOverrideProgress(null);
    }
  }, [unifiedProgress]);

  useEffect(() => {
    const registry = AuthNotificationRegistry.getInstance?.();
    if (!registry) return;
    const id = 'location-progress-hook';
    registry.register?.(id, {
      onAuthRequired: async (n) => {
        setOverrideProgress({
          nodeId: nodeId || n?.context?.nodeId || 'location',
          stage: 'auth-required',
          total: 1,
          completed: 0,
          failed: 0,
          percentage: 0,
          currentTask: n?.context?.errorMessage || 'Authentication required',
          timestamp: Date.now(),
          message: n?.context?.errorMessage,
        });
      },
      onAuthSuccess: async (_n) => {
        setOverrideProgress({
          nodeId: nodeId || 'location',
          stage: 'resumed',
          total: 1,
          completed: 1,
          failed: 0,
          percentage: 100,
          currentTask: 'Authentication successful - resuming',
          timestamp: Date.now(),
          message: 'Authentication successful - resuming',
        });
      },
      onAuthCancelled: async (n) => {
        setOverrideProgress({
          nodeId: nodeId || 'location',
          stage: 'cancelled',
          total: 1,
          completed: 0,
          failed: 1,
          percentage: 0,
          currentTask: n?.context?.reason || 'Authentication cancelled',
          timestamp: Date.now(),
          message: n?.context?.reason,
        });
      },
    });
    return () => {
      registry.unregister?.(id);
    };
  }, [nodeId]);

  return {
    progress: derivedProgress ?? overrideProgress,
    unifiedProgress: unifiedProgress ?? null,
    isSubscribed,
    error,
    subscribe,
    unsubscribe,
  };
}
