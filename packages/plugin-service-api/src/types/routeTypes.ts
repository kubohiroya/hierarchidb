import type { NodeId } from '@hierarchidb/common-types';

export interface RouteNearestLineQuery {
  nodeId: NodeId;
  longitude: number;
  latitude: number;
  zoom: number;
  maxDistanceMeters: number;
}

export interface RouteNearestEndpoint {
  name?: string;
  admin1Name?: string;
  admin0Name?: string;
  pointId?: string;
}

export interface RouteNearestLine {
  lineStringId?: string;
  featureId?: string;
  routeMode?: string;
  routeDistanceMeters?: number;
  start?: RouteNearestEndpoint;
  end?: RouteNearestEndpoint;
}

export interface RouteNearestLineMatch {
  line: RouteNearestLine;
  distanceMeters: number;
}

export interface RouteNearestLineResponse {
  cursor: {
    longitude: number;
    latitude: number;
  };
  matches: RouteNearestLineMatch[];
}

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
