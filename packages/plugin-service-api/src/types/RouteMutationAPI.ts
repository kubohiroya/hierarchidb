import type { NodeId } from '@hierarchidb/common-types';

export interface RouteMutationAPI {
  deleteRouteResults(nodeId: NodeId): Promise<void>;
  deleteRouteCache(nodeId: NodeId): Promise<void>;
  deleteRouteCursors(nodeId: NodeId): Promise<void>;
  deletePendingSessions(nodeId: NodeId): Promise<void>;
}
