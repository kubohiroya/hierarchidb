import type { NodeId, NodeType } from '@hierarchidb/core-types';
import {
  useBuildSessionStateTreeBridge,
  useBuildSessionMutation,
  type UnifiedBuildSessionProgressResult,
} from '@hierarchidb/ui-build-sessions';

const ROUTE_NODE_TYPE = 'route' as NodeType;
const ROUTE_STAGE_IDS = ['source', 'geometry', 'tileEmit'] as const;
type RouteStageId = (typeof ROUTE_STAGE_IDS)[number];

export type RouteBuildProgressResult = UnifiedBuildSessionProgressResult;

export function useRouteBuildProgress(nodeId: NodeId | null): RouteBuildProgressResult {
  const {
    isMutating,
    mutationError,
    pauseSession,
    resumeSession,
  } = useBuildSessionMutation(ROUTE_NODE_TYPE, nodeId);
  const { progressState } = useBuildSessionStateTreeBridge<RouteStageId>({
    nodeType: ROUTE_NODE_TYPE,
    nodeId,
    stageIds: ROUTE_STAGE_IDS,
    defaultActiveStageId: 'source',
    resolveStageId: (value: unknown): RouteStageId => {
      if (value === 'source' || value === 'geometry' || value === 'tileEmit') return value;
      throw new Error(`[route buildSessionStateTreeBridge] unsupported stage: ${String(value)}`);
    },
    mapBuildStatusToPhase: (status) => {
      if (status === 'idle') return 'idle';
      if (status === 'queued') return 'starting';
      if (status === 'running') return 'running';
      if (status === 'paused') return 'paused';
      if (status === 'completed') return 'completed';
      if (status === 'failed') return 'failed';
      if (status === 'recycled') return 'finalizing';
      throw new Error(`[route buildSessionStateTreeBridge] unsupported status: ${String(status)}`);
    },
  });

  return {
    snapshot: progressState.unifiedProgress,
    ready: progressState.progress != null,
    progress: progressState.progress,
    status: progressState.status,
    isPaused: progressState.status?.status === 'paused',
    isMutating,
    mutationError,
    lastError: progressState.status?.error ?? progressState.progress?.message ?? null,
    pause: async () => {
      await pauseSession();
    },
    resume: async () => {
      await resumeSession();
    },
  };
}
