import type { NodeId, NodeType } from '@hierarchidb/core-types';
import {
  type BuildSessionProgressResult,
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
  const { progressState } = useBuildSessionStateTreeBridge<RouteStageId>({
    nodeType: ROUTE_NODE_TYPE,
    nodeId,
    subscriptionTransport: 'same-realm',
    stageIds: ROUTE_STAGE_IDS,
    defaultActiveStageId: 'source',
    resolveStageId: resolveRouteStageId,
  });

  return {
    snapshot: progressState.progress,
    ready: progressState.progress != null,
    progress: progressState.progress,
    status: progressState.status,
    lastError:
      progressState.status?.error ??
      progressState.progress?.message ??
      progressState.error?.message ??
      null,
  };
}
