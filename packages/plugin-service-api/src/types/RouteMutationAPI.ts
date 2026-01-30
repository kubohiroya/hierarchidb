import type { NodeId } from '@hierarchidb/common-types';
import type {
  IdeGsmImportCallback,
  IdeGsmRouteImportRequest,
  IdeGsmRouteImportResult,
} from './ideGsmTypes.js';

export interface RouteWaypointPoint {
  coordinates?: [number, number];
  name?: string;
  admin1Name?: string;
  admin0Name?: string;
  pointId?: string;
}

export interface RouteWaypointInput {
  id: string;
  routeMode?: string;
  startPoint?: RouteWaypointPoint;
  endPoint?: RouteWaypointPoint;
  distance?: number;
  speed?: number;
}

export interface RouteWaypointResult {
  id: string;
  waypoints?: [number, number][];
  distance?: number;
  speed?: number;
}

export interface RouteMutationAPI {
  deleteRouteLineStrings(nodeId: NodeId): Promise<void>;
  clearRouteArtifacts(nodeId: NodeId): Promise<void>;
  applyIdeGsmWaypoints(lines: RouteWaypointInput[]): Promise<RouteWaypointResult[]>;
  importIdeGsmRoutes(
    request: IdeGsmRouteImportRequest,
    progress?: IdeGsmImportCallback,
  ): Promise<IdeGsmRouteImportResult>;
}
