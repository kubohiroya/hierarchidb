import type { NodeId } from '@hierarchidb/core-types';
import type { IdeGsmImportCallback } from '@hierarchidb/location-api';
import type { IdeGsmLocationRecord } from './ideGsmRouteCsv.js';
import type { IdeGsmRouteImportRequest, IdeGsmRouteImportResult } from './ideGsmRouteTypes.js';
import type { RouteWaypointInput, RouteWaypointResult } from './routeTypes.js';

export interface RouteMutationAPI {
  deleteRouteLineStrings(nodeId: NodeId): Promise<void>;
  clearRouteArtifacts(nodeId: NodeId): Promise<void>;
  applyIdeGsmWaypoints(lines: RouteWaypointInput[]): Promise<RouteWaypointResult[]>;
  resolveIdeGsmLocationIndex(nodeId: NodeId): Promise<Record<string, IdeGsmLocationRecord>>;
  importIdeGsmRoutes(
    request: IdeGsmRouteImportRequest,
    progress?: IdeGsmImportCallback,
  ): Promise<IdeGsmRouteImportResult>;
}
