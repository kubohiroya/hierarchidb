import type { GroupEntity, NodeId } from '@hierarchidb/common-types';
import type { LocationPointId } from '@hierarchidb/location-plugin';

export const ROUTE_MODES = {
  AIRWAY: 'airway',
  WATERWAY: 'waterway',
  RAILWAY: 'railway',
  H_RAILWAY: 'high-speed-railway',
  ROAD: 'road',
  HIGHWAY: 'highway',
} as const;
export type RouteMode = typeof ROUTE_MODES[keyof typeof ROUTE_MODES];

/**
 * Point type for hybrid location management
 */
export interface RoutePoint {
  coordinates: [number, number];
  pointId: LocationPointId;
  locationId?: NodeId;

  name: string;
  admin0Name: string;
  admin1Name: string;
  admin2Name?: string;
}

export interface RouteLineString extends GroupEntity {

  name: string;
  featureId: string;

  routeMode: RouteMode;

  startPoint: RoutePoint;
  endPoint: RoutePoint;

  waypoints?: [number, number][];  // LineString coordinates
  distance?: number;
  speed?: number;
  metadata?: Record<string, string | number | boolean>;
}
