import type { NodeId } from '@hierarchidb/common-types';
import type { IdeGsmImportCallback } from '@hierarchidb/location-api';
import type { IdeGsmRouteImportRequest, IdeGsmRouteImportResult } from './ideGsmRouteTypes.js';
import type { RouteWaypointInput, RouteWaypointResult } from './routeTypes.js';

export interface RouteMutationAPI {
  deleteRouteLineStrings(nodeId: NodeId): Promise<void>;
  clearRouteArtifacts(nodeId: NodeId): Promise<void>;
  applyIdeGsmWaypoints(lines: RouteWaypointInput[]): Promise<RouteWaypointResult[]>;
  importIdeGsmRoutes(
    request: IdeGsmRouteImportRequest,
    progress?: IdeGsmImportCallback,
  ): Promise<IdeGsmRouteImportResult>;
}
