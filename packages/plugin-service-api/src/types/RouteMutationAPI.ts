import type { NodeId } from '@hierarchidb/common-types';
import type { RouteWaypointInput, RouteWaypointResult } from './routeTypes.js';
import type {
  IdeGsmImportCallback,
  IdeGsmRouteImportRequest,
  IdeGsmRouteImportResult,
} from './ideGsmTypes.js';

export interface RouteMutationAPI {
  deleteRouteLineStrings(nodeId: NodeId): Promise<void>;
  clearRouteArtifacts(nodeId: NodeId): Promise<void>;
  applyIdeGsmWaypoints(lines: RouteWaypointInput[]): Promise<RouteWaypointResult[]>;
  importIdeGsmRoutes(
    request: IdeGsmRouteImportRequest,
    progress?: IdeGsmImportCallback,
  ): Promise<IdeGsmRouteImportResult>;
}
