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

/**
 * Exposes route plugin artifacts.
 * Data is persisted independently and is not yet tied to TreeNode lifecycle events.
 */
export interface RouteQueryAPI {
  findNearestRouteLine(query: RouteNearestLineQuery): Promise<RouteNearestLineResponse>;
  getVectorTile(nodeId: NodeId, z: number, x: number, y: number): Promise<ArrayBuffer | null>;
}
