import type { NodeId } from '@hierarchidb/core-types';
import type {
  RouteLineString,
  RouteMetadataSyncSummary,
  RouteNearestLineQuery,
  RouteNearestLineResponse,
} from './ROUTE_MODES.js';
import type { RouteBuildError } from './routeBuildTypes.js';

/**
 * Exposes route plugin artifacts.
 * Data is persisted independently and is not yet tied to TreeNode lifecycle events.
 */
export interface RouteQueryAPI {
  findNearestRouteLine(query: RouteNearestLineQuery): Promise<RouteNearestLineResponse>;
  getVectorTile(nodeId: NodeId, z: number, x: number, y: number): Promise<ArrayBuffer | null>;
  listRouteLineStrings(nodeId: NodeId): Promise<RouteLineString[]>;
  listRouteBuildErrors(nodeId: NodeId): Promise<RouteBuildError[]>;
  checkRouteMetadataSync(nodeId: NodeId): Promise<RouteMetadataSyncSummary>;
  countRouteReferencesToLocations(locationNodeIds: NodeId[]): Promise<number>;
}
