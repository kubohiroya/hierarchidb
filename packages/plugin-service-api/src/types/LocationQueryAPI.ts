import type { NodeId } from '@hierarchidb/common-types';
import type { LocationGroupItemData, LocationRelationMeta } from './locationTypes.js';

export interface LocationGroupItem {
  id: string;
  data?: LocationGroupItemData;
  updatedAt?: number;
}

export interface LocationRelation {
  srcNodeId: NodeId;
  dstNodeId: NodeId;
  type: string;
  meta?: LocationRelationMeta;
  updatedAt?: number;
}

export interface LocationNearestPointQuery {
  nodeId: NodeId;
  longitude: number;
  latitude: number;
  zoom: number;
  maxDistanceMeters: number;
}

export interface LocationNearestPoint {
  id?: string;
  name?: string;
  kind?: string;
  region?: string;
  countryName?: string;
  longitude: number;
  latitude: number;
  properties?: Record<string, unknown>;
}

export interface LocationNearestPointMatch {
  point: LocationNearestPoint;
  distanceMeters: number;
}

export interface LocationNearestPointResponse {
  cursor: {
    longitude: number;
    latitude: number;
  };
  matches: LocationNearestPointMatch[];
}

/**
 * Exposes location plugin artifacts.
 * Data is persisted independently and is not yet tied to TreeNode lifecycle events.
 */
export interface LocationQueryAPI {
  listLocationGroups(nodeId: NodeId): Promise<LocationGroupItem[]>;
  listLocationRelations(nodeId: NodeId): Promise<LocationRelation[]>;
  findNearestLocationPoint(query: LocationNearestPointQuery): Promise<LocationNearestPointResponse>;
  getVectorTile(nodeId: NodeId, z: number, x: number, y: number): Promise<ArrayBuffer | null>;
}
