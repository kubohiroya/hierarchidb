import type { NodeId } from '@hierarchidb/core-types';
import type { IdeGsmLocationRecord } from './ideGsmRouteCsv.js';
import type { IdeGsmRouteCoverageResult, IdeGsmRouteImportRequest } from './ideGsmRouteTypes.js';
import type { RouteWaypointInput, RouteWaypointResult } from './ROUTE_MODES.js';
import type { IdeGsmRouteBuildRoutesRequest, RouteBuildRouteInput } from './routeBuildTypes.js';

export interface RouteMutationAPI {
  deleteRouteLineStrings(nodeId: NodeId): Promise<void>;
  clearRouteArtifacts(nodeId: NodeId): Promise<void>;
  applyIdeGsmWaypoints(lines: RouteWaypointInput[]): Promise<RouteWaypointResult[]>;
  resolveIdeGsmLocationIndex(nodeId: NodeId): Promise<Record<string, IdeGsmLocationRecord>>;
  resolveIdeGsmRouteCoverage(request: IdeGsmRouteImportRequest): Promise<IdeGsmRouteCoverageResult>;
  resolveIdeGsmRouteBuildRoutes(
    request: IdeGsmRouteBuildRoutesRequest
  ): Promise<RouteBuildRouteInput[]>;
}
