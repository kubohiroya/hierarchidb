import type { NodeId } from '@hierarchidb/core-types';
import {
  type BuildSessionProgressResult,
  useBuildSessionStateTreeBridge,
} from '@hierarchidb/ui-build-sessions';
import { type RouteBuildStageId, routeBuildUiAdapter } from '~/ui/routeBuildUiAdapter.js';

export type RouteBuildProgressResult = BuildSessionProgressResult & {
  subscriptionReady: boolean;
};

export function useRouteBuildProgress(nodeId: NodeId | null): RouteBuildProgressResult {
  const { progressState, subscriptionReady } = useBuildSessionStateTreeBridge<RouteBuildStageId>({
    nodeType: routeBuildUiAdapter.nodeType,
    nodeId,
    subscriptionTransport: routeBuildUiAdapter.subscriptionTransport,
    stageIds: routeBuildUiAdapter.stageIds,
    defaultActiveStageId: routeBuildUiAdapter.defaultActiveStageId,
    resolveStageId: routeBuildUiAdapter.resolveStageId,
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
    subscriptionReady,
  };
}
