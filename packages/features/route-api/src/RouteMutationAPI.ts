import type { NodeId } from '@hierarchidb/core-types';
import type { IdeGsmImportCallback } from '@hierarchidb/location-api';
import type { IdeGsmLocationRecord } from './ideGsmRouteCsv.js';
import type {
  IdeGsmRouteCoverageResult,
  IdeGsmRouteImportRequest,
  IdeGsmRouteImportResult,
} from './ideGsmRouteTypes.js';
import type {
  RouteTileIndexRequest,
  RouteTileIndexResult,
  RouteVectorTileBuildRequest,
  RouteVectorTileBuildResult,
} from './routeBuildTypes.js';
import type { RouteWaypointInput, RouteWaypointResult } from './routeTypes.js';

export interface RouteMutationAPI {
  deleteRouteLineStrings(nodeId: NodeId): Promise<void>;
  clearRouteArtifacts(nodeId: NodeId): Promise<void>;
  applyIdeGsmWaypoints(lines: RouteWaypointInput[]): Promise<RouteWaypointResult[]>;
  resolveIdeGsmLocationIndex(nodeId: NodeId): Promise<Record<string, IdeGsmLocationRecord>>;
  resolveIdeGsmRouteCoverage(
    request: IdeGsmRouteImportRequest,
  ): Promise<IdeGsmRouteCoverageResult>;
  importIdeGsmRoutes(
    request: IdeGsmRouteImportRequest,
    progress?: IdeGsmImportCallback,
  ): Promise<IdeGsmRouteImportResult>;
  buildRouteTileIndex(request: RouteTileIndexRequest): Promise<RouteTileIndexResult>;
  generateRouteVectorTiles(request: RouteVectorTileBuildRequest): Promise<RouteVectorTileBuildResult>;
}
