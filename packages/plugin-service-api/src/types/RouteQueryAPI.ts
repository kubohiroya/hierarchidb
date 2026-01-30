import type { NodeId } from '@hierarchidb/common-types';
import type { RouteNearestLineQuery, RouteNearestLineResponse } from '@hierarchidb/route-api';

/**
 * Exposes route plugin artifacts.
 * Data is persisted independently and is not yet tied to TreeNode lifecycle events.
 */
export interface RouteQueryAPI {
  findNearestRouteLine(query: RouteNearestLineQuery): Promise<RouteNearestLineResponse>;
  getVectorTile(nodeId: NodeId, z: number, x: number, y: number): Promise<ArrayBuffer | null>;
}
