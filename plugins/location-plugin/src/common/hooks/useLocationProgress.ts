import { useEffect, useState } from 'react';
import type { NodeId, NodeType, ProgressEvent } from '@hierarchidb/common-types';
import type { UnifiedProgressInfo } from '@hierarchidb/common-api';
import { AuthNotificationRegistry } from '@hierarchidb/common-auth';
import { usePluginBatchProgress } from '@hierarchidb/ui-batch-progress';

export interface UseLocationProgressOptions {
  autoSubscribe?: boolean;
}

export interface LocationProgressEvent extends ProgressEvent {
  message?: string;
}

export interface UseLocationProgressState {
  progress: LocationProgressEvent | null;
  unifiedProgress: UnifiedProgressInfo | null;
  error: Error | null;
}

const LOCATION_NODE_TYPE = 'location' as NodeType;

type ExtendedProgressInfo = UnifiedProgressInfo & {
  phase?: string;
  timestamp?: number;
  message?: string;
  nodeId?: NodeId;
};

function toProgressEvent(
  info: ExtendedProgressInfo | null,
  fallbackNodeId: NodeId,
): LocationProgressEvent | null {
  if (!info) return null;
  const resolvedNodeId = info.nodeId ?? fallbackNodeId;
  const taskType = info.phase === 'completed' ? 'completed' : info.stage;
  const event: LocationProgressEvent = {
    nodeId: resolvedNodeId,
    taskType,
    total: info.total ?? 0,
    completed: info.completed ?? 0,
    failed: info.failed ?? 0,
    percentage: info.percentage ?? 0,
    timestamp: typeof info.timestamp === 'number' ? info.timestamp : Date.now(),
    message: info.message,
  };
  return event;
}

/**
 * useLocationProgress - Subscribe to Location batch progress events via WorkerBridge.
 */
export function useLocationProgress(
  nodeId: NodeId,
  options: UseLocationProgressOptions = {},
): UseLocationProgressState & { subscribe: () => void; unsubscribe: () => void } {
  const { autoSubscribe = true } = options;
  const [overrideProgress, setOverrideProgress] = useState<LocationProgressEvent | null>(null);
  const {
    progress: derivedProgress,
    unifiedProgress,
    error,
    subscribe,
    unsubscribe,
  } = usePluginBatchProgress<LocationProgressEvent>(
    LOCATION_NODE_TYPE,
    nodeId,
    {
      autoSubscribe,
      mapUnifiedToProgress: (info: UnifiedProgressInfo | null) =>
        toProgressEvent(info as ExtendedProgressInfo | null, nodeId),
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
          nodeId,
          taskType: 'auth-required',
          total: 1,
          completed: 0,
          failed: 0,
          percentage: 0,
          timestamp: Date.now(),
          message: n?.context?.errorMessage,
        });
      },
      onAuthSuccess: async (_n) => {
        setOverrideProgress({
          nodeId,
          taskType: 'resumed',
          total: 1,
          completed: 1,
          failed: 0,
          percentage: 100,
          timestamp: Date.now(),
          message: 'Authentication successful - resuming',
        });
      },
      onAuthCancelled: async (n) => {
        setOverrideProgress({
          nodeId,
          taskType: 'failed',
          total: 1,
          completed: 0,
          failed: 1,
          percentage: 0,
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
    error,
    subscribe,
    unsubscribe,
  };
}
