import type { CountryCode, NodeId } from '@hierarchidb/common-types';

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

export type LocationPointKind = LocationType | string;

export type LocationPointMetadata = Record<string, string | number | null>;

export type LocationPointId = string & { readonly __brand: 'LocationPointId' };

export interface LocationPointProperties {
  schemaVersion: 2;
  pointId: LocationPointId;
  name: string;
  latitude: number;
  longitude: number;
  type: LocationPointKind;
  countryName?: string;
  countryCode: CountryCode;
  admin1?: string;
  admin2?: string;
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
  metadata?: LocationPointMetadata;
}

export interface LocationGroupItemData extends LocationPointProperties {}

export interface LocationRelationMeta {
  schemaVersion: 1;
  relationKind?: string;
  weight?: number;
  metadata?: Record<string, unknown>;
}
