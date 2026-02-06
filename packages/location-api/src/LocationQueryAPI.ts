import type { NodeId } from '@hierarchidb/core-types';
import type { LocationFeature, LocationGroupItemData, LocationRelationMeta } from './locationTypes.js';

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

export type LocationViewportBbox = [number, number, number, number];

export interface LocationViewportQueryOptions {
  prefetchMarginPx?: number;
  prefetchMarginRatio?: number;
  viewportSizePx?: {
    width: number;
    height: number;
  };
  maxPoints?: number;
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
  type?: string;
  region?: string;
  admin0?: string;
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
  listLocationFeatures(nodeId: NodeId): Promise<LocationFeature[]>;
  listLocationGroups(nodeId: NodeId): Promise<LocationGroupItem[]>;
  listLocationRelations(nodeId: NodeId): Promise<LocationRelation[]>;
  queryByViewport(
    nodeId: NodeId,
    bbox: LocationViewportBbox,
    zoom: number,
    types?: string[],
    options?: LocationViewportQueryOptions,
  ): Promise<LocationFeature[]>;
  queryByMortonPrefixes(nodeId: NodeId, prefixes: string[], types?: string[]): Promise<LocationFeature[]>;
  findNearestLocationPoint(query: LocationNearestPointQuery): Promise<LocationNearestPointResponse>;
}
