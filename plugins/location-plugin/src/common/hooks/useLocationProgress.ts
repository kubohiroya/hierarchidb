import { AuthNotificationRegistry } from '@hierarchidb/auth';
import type { BuildStatus } from '@hierarchidb/build-api';
import type { NodeId, NodeType } from '@hierarchidb/core-types';
import type { BuildSessionProgressSnapshot } from '@hierarchidb/ui-build-sessions';
import { useBuildSessionStateTreeBridge } from '@hierarchidb/ui-build-sessions';
import { useEffect, useId, useRef, useState } from 'react';

export interface UseLocationProgressOptions {
  autoSubscribe?: boolean;
}

type ProgressEvent = {
  nodeId: NodeId;
  stage: string;
  status: BuildStatus;
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
    stage: progress.stage,
    status: progress.status,
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
  const handlerInstanceId = useId();
  const acceptedAuthRequestIdsRef = useRef(new Set<string>());
  const { progressState } = useBuildSessionStateTreeBridge<LocationStageId>({
    nodeType: LOCATION_NODE_TYPE,
    nodeId,
    autoSubscribe: options.autoSubscribe ?? true,
    subscriptionTransport: 'same-realm',
    stageIds: LOCATION_STAGE_IDS,
    defaultActiveStageId: 'source',
    resolveStageId: resolveLocationStageId,
  });
  const derivedProgress = toProgressEvent(progressState.progress);

  useEffect(() => {
    if (progressState.progress?.status === 'running') {
      acceptedAuthRequestIdsRef.current.clear();
      setAuthNotice(null);
    }
  }, [progressState.progress?.status]);

  useEffect(() => {
    const registry = AuthNotificationRegistry.getInstance?.();
    if (!registry) return;
    const id = `location-progress-hook:${String(nodeId)}:${handlerInstanceId}`;
    const acceptedRequestIds = acceptedAuthRequestIdsRef.current;
    registry.register?.(id, {
      onAuthRequired: async (notification) => {
        if (notification.context.pluginType !== 'location') return;
        if (
          notification.context.sessionId !== undefined &&
          notification.context.sessionId !== String(nodeId)
        ) {
          return;
        }
        acceptedRequestIds.add(notification.context.requestId);
        setAuthNotice({
          state: 'required',
          timestamp: Date.now(),
          message: notification?.context?.errorMessage,
        });
      },
      onAuthSuccess: async (notification) => {
        if (!acceptedRequestIds.delete(notification.context.requestId)) return;
        if (acceptedRequestIds.size > 0) return;
        setAuthNotice({
          state: 'resumed',
          timestamp: Date.now(),
          message: 'Authentication successful - resuming',
        });
      },
      onAuthCancelled: async (notification) => {
        if (!acceptedRequestIds.delete(notification.context.requestId)) return;
        if (acceptedRequestIds.size > 0) return;
        setAuthNotice({
          state: 'cancelled',
          timestamp: Date.now(),
          message: notification?.context?.reason,
        });
      },
    });
    return () => {
      registry.unregister?.(id);
      acceptedRequestIds.clear();
    };
  }, [handlerInstanceId, nodeId]);

  return {
    progress: derivedProgress,
    sessionProgress: progressState.progress,
    authNotice,
    error: progressState.error,
  };
}
