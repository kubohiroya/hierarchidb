import type { NodeId } from '@hierarchidb/common-types';
import type { RouteResultItem } from './routeTypes.js';

/**
 * Exposes route plugin artifacts.
 * Data is persisted independently and is not yet tied to TreeNode lifecycle events.
 */
export interface RouteQueryAPI {
  listRouteResults(nodeId: NodeId): Promise<RouteResultItem[]>;
}
