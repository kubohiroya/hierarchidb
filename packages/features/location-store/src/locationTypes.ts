import type { NodeId } from '@hierarchidb/common-types';
import { ShapeContainerNodeId } from '@hierarchidb/shape-store';

export type LocationType =
  | 'area_centroid'
  | 'airport'
  | 'port'
  | 'railway_station'
  | 'interchange';

export type LocationDataSource =
  | 'openstreetmap'
  | 'geonames'
  | 'wikidata'
  | 'overpass'
  | 'ourairports'
  | 'openflights'
  | 'world-port-index'
  | 'natural-earth'
  | 'ide-gsm'
  | 'custom'
  | 'manual';

export type LocationProcessingStatus =
  | 'pending'
  | 'searching'
  | 'processing'
  | 'validating'
  | 'completed'
  | 'failed';

export type LocationRepresentationByZoomLevel = {
  pointFromZoom: number;
  polygonFromZoom: number;
  iconFromZoom: number;
  iconFixedFromZoom: number;
};

export type LocationRepresentationByZoomLevelConfig = Record<LocationType, LocationRepresentationByZoomLevel>;

export type LocationIconId =
  | 'public'
  | 'location_city'
  | 'flight_takeoff'
  | 'directions_boat'
  | 'train'
  | 'fork_right';

export type LocationIconConfigEntry = {
  color: string;
  iconId: LocationIconId;
  sizeRange: [number, number];
};

export type LocationIconConfig = Record<LocationType, LocationIconConfigEntry>;

export type LocationLabelConfigEntry = {
  color: string;
  zoomRange: [number, number];
  sizeRange: [number, number];
};

export type LocationLabelConfig = Record<LocationType, LocationLabelConfigEntry>;

export type IdeGsmSourceEntry = {
  fileName: string;
  sourceUrl: string;
  sizeBytes?: number;
  sourceType?: 'local' | 'remote';
};

export type LocationMetadata = Record<string, string | number | null>;

export type LocationPointId = string & { readonly __brand: 'LocationPointId' };
export type LocationFeatureId = string & { readonly __brand: 'LocationFeatureId' };

export interface LocationFeatureProperties {
  schemaVersion: 2;
  pointId: LocationPointId;
  name: string;
  latitude: number;
  longitude: number;
  type: LocationType;
  admin0Name?: string;
  admin1Name?: string;
  admin2Name?: string;
  admin0Code?: string;
  admin1Code?: string;
  admin2Code?: string;
  centroidForShapeId?: number;
  centroidForShapeContainerNodeId?: NodeId;
  z0?: string;
  z1?: string;
  z2?: string;
  z3?: string;
  z4?: string;
  z5?: string;
  z6?: string;
  z7?: string;
  z8?: string;
  z9?: string;
  mortonKey?: string;
  metadata?: LocationMetadata;
}

export type LocationPointProperties = LocationFeatureProperties;

export type LocationFeature = {
  nodeId: NodeId;
  id: LocationFeatureId;
  type: string;
  data: LocationFeatureProperties;
  centroidForShapeId?: number;
  centroidForShapeContainerNodeId?: ShapeContainerNodeId;
  updatedAt?: number;
};
