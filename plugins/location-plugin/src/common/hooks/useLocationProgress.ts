import { AuthNotificationRegistry } from '@hierarchidb/auth';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { BuildSessionProgressSnapshot } from '@hierarchidb/ui-build-sessions';
import { useBuildSessionStateTreeBridge } from '@hierarchidb/ui-build-sessions';
import { useEffect, useState } from 'react';

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

export interface LocationAuthNotice {
  state: 'required' | 'resumed' | 'cancelled';
  timestamp: number;
  message?: string;
}

export interface UseLocationProgressState {
  progress: LocationProgressEvent | null;
  sessionProgress: BuildSessionProgressSnapshot | null;
  authNotice: LocationAuthNotice | null;
  error: Error | null;
}

const LOCATION_NODE_TYPE = 'location' as NodeType;
const LOCATION_STAGE_IDS = ['source'] as const;
type LocationStageId = (typeof LOCATION_STAGE_IDS)[number];

const resolveLocationStageId = (value: unknown): LocationStageId => {
  if (value === 'source') return value;
  throw new Error(`[useLocationProgress] unsupported stage: ${String(value)}`);
};

const toProgressEvent = (
  progress: BuildSessionProgressSnapshot | null
): LocationProgressEvent | null => {
  if (!progress) return null;
  return {
    nodeId: progress.nodeId,
    stage: progress.status === 'completed' ? 'completed' : progress.stage,
    total: progress.taskCounts.total,
    completed: progress.taskCounts.completed,
    failed: progress.taskCounts.failed,
    percentage: progress.percentage,
    timestamp: progress.timestamp,
    message: progress.message,
  };
};

/** Subscribe to canonical Location build-session events through the shared state tree. */
export function useLocationProgress(
  nodeId: NodeId,
  options: UseLocationProgressOptions = {}
): UseLocationProgressState {
  const [authNotice, setAuthNotice] = useState<LocationAuthNotice | null>(null);
  const { progressState } = useBuildSessionStateTreeBridge<LocationStageId>({
    nodeType: LOCATION_NODE_TYPE,
    nodeId,
    autoSubscribe: options.autoSubscribe ?? true,
    stageIds: LOCATION_STAGE_IDS,
    defaultActiveStageId: 'source',
    resolveStageId: resolveLocationStageId,
  });
  const derivedProgress = toProgressEvent(progressState.progress);

  // The registry callback does not capture node-specific state; register it for
  // the lifetime of this hook instance.
  useEffect(() => {
    if (progressState.progress?.status === 'running') {
      setAuthNotice(null);
    }
  }, [progressState.progress?.status]);

  useEffect(() => {
    const registry = AuthNotificationRegistry.getInstance?.();
    if (!registry) return;
    const id = 'location-progress-hook';
    registry.register?.(id, {
      onAuthRequired: async (notification) => {
        setAuthNotice({
          state: 'required',
          timestamp: Date.now(),
          message: notification?.context?.errorMessage,
        });
      },
      onAuthSuccess: async () => {
        setAuthNotice({
          state: 'resumed',
          timestamp: Date.now(),
          message: 'Authentication successful - resuming',
        });
      },
      onAuthCancelled: async (notification) => {
        setAuthNotice({
          state: 'cancelled',
          timestamp: Date.now(),
          message: notification?.context?.reason,
        });
      },
    });
    return () => {
      registry.unregister?.(id);
    };
  }, []);

  return {
    progress: derivedProgress,
    sessionProgress: progressState.progress,
    authNotice,
    error: progressState.error,
  };
}
