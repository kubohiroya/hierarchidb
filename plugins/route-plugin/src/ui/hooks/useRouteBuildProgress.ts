import type { NodeId, NodeType } from '@hierarchidb/core-types';
import {
  type BuildSessionProgressResult,
  useBuildSessionMutation,
  useBuildSessionStateTreeBridge,
} from '@hierarchidb/ui-build-sessions';

const ROUTE_NODE_TYPE = 'route' as NodeType;
const ROUTE_STAGE_IDS = ['source', 'geometry', 'tileEmit'] as const;
type RouteStageId = (typeof ROUTE_STAGE_IDS)[number];

const resolveRouteStageId = (value: unknown): RouteStageId => {
  if (value === 'source' || value === 'geometry' || value === 'tileEmit') return value;
  throw new Error(`[route buildSessionStateTreeBridge] unsupported stage: ${String(value)}`);
};

export type RouteBuildProgressResult = BuildSessionProgressResult;

export function useRouteBuildProgress(nodeId: NodeId | null): RouteBuildProgressResult {
  const { isMutating, mutationError, pauseSession, resumeSession } = useBuildSessionMutation(
    ROUTE_NODE_TYPE,
    nodeId
  );
  const { progressState } = useBuildSessionStateTreeBridge<RouteStageId>({
    nodeType: ROUTE_NODE_TYPE,
    nodeId,
    stageIds: ROUTE_STAGE_IDS,
    defaultActiveStageId: 'source',
    resolveStageId: resolveRouteStageId,
  });

  return {
    snapshot: progressState.progress,
    ready: progressState.progress != null,
    progress: progressState.progress,
    status: progressState.status,
    isPaused: progressState.status?.status === 'paused',
    isMutating,
    mutationError,
    lastError:
      progressState.status?.error ??
      progressState.progress?.message ??
      progressState.error?.message ??
      null,
    pause: async () => {
      await pauseSession();
    },
    resume: async () => {
      await resumeSession();
    },
  };
}
