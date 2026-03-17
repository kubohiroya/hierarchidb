import { useEffect, useState } from 'react';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { BuildProgressPayload, BuildUnifiedProgressInfo } from '@hierarchidb/build-api';
import { AuthNotificationRegistry } from '@hierarchidb/auth';
import { usePluginBuildProgress } from '@hierarchidb/ui-build-sessions';

export interface UseLocationProgressOptions {
  autoSubscribe?: boolean;
}

type ProgressEvent = {
  nodeId: NodeId;
  stage: string;
  total: number;
  completed: number;
  failed: number;
  percentage: number;
  timestamp: number;
};

export interface LocationProgressEvent extends ProgressEvent {
  message?: string;
}

export interface UseLocationProgressState {
  progress: LocationProgressEvent | null;
  unifiedProgress: BuildUnifiedProgressInfo | null;
  error: Error | null;
}

const LOCATION_NODE_TYPE = 'location' as NodeType;

const assertFiniteNumber = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`[useLocationProgress] ${label} must be a finite number, received ${String(value)}`);
  }
  return value;
};

function toProgressEvent(
  info: BuildUnifiedProgressInfo | null,
  fallbackNodeId: NodeId,
): LocationProgressEvent | null {
  if (!info) return null;
  const resolvedNodeId = info.nodeId ?? fallbackNodeId;
  const payload = info.payload as BuildProgressPayload | undefined;
  if (!payload) {
    throw new Error(`[useLocationProgress] info.payload is required but was absent (nodeId=${String(resolvedNodeId)}, stage=${String(info.stage)})`);
  }
  const total = assertFiniteNumber(payload.total, 'payload.total');
  const completed = assertFiniteNumber(payload.completed, 'payload.completed');
  const failed = assertFiniteNumber(payload.failed, 'payload.failed');
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  const stage = info.phase === 'completed' ? 'completed' : info.stage;
  return {
    nodeId: resolvedNodeId,
    stage,
    total,
    completed,
    failed,
    percentage,
    timestamp: typeof info.timestamp === 'number' ? info.timestamp : Date.now(),
    message: info.message,
  };
}

/**
 * useLocationProgress - Subscribe to Location build progress events via WorkerBridge.
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
  } = usePluginBuildProgress<LocationProgressEvent>(
    LOCATION_NODE_TYPE,
    nodeId,
    {
      autoSubscribe,
      mapUnifiedToProgress: (info: BuildUnifiedProgressInfo | null) =>
        toProgressEvent(info, nodeId),
    },
  );

  useEffect(() => {
    setOverrideProgress(null);
  }, []);

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
          stage: 'auth-required',
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
          stage: 'resumed',
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
          stage: 'failed',
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
