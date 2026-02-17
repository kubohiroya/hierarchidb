import type { CountryCode, NodeId } from '@hierarchidb/core-types';

export type LocationPointKind = string;

export type LocationPointMetadata = Record<string, string | number | null>;

export type LocationPointId = string & { readonly __brand: 'LocationPointId' };
export type LocationFeatureId = string & { readonly __brand: 'LocationFeatureId' };

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
  tabularSourceId: string;
  sizeBytes?: number;
  sourceType?: 'local' | 'remote';
};

export type IdeGsmSelectionEntry = {
  countryCode: CountryCode;
  countryName: string;
  types: string[];
};

export type LocationSearchOptions = {
  nominatimEndpoint?: string;
  addressDetails?: boolean;
  extraTags?: boolean;
  nameDetails?: boolean;
  overpassEndpoint?: string;
  overpassQuery?: string;
  customEndpoint?: string;
  customHeaders?: Record<string, string>;
  queryParams?: Record<string, unknown>;
  [key: string]: unknown;
};

export type LocationSearchConfig = {
  dataSource: LocationDataSource;
  query?: string;
  limit?: number;
  types?: LocationType[];
  countryCode?: string;
  countryName?: string;
  boundingBox?: [number, number, number, number];
  language?: string;
  options?: LocationSearchOptions;
};

export type LocationBuildProcessingOptions = {
  concurrent?: number;
  geocodeMissing?: boolean;
  validateResults?: boolean;
  [key: string]: unknown;
};

export type LocationBuildFilterCriteria = {
  countryCodes?: string[];
  countryNames?: string[];
  allowedTypes?: LocationType[];
  excludeIds?: string[];
};

export interface LocationPointProperties {
  schemaVersion: 2;
  pointId: LocationPointId;
  name: string;
  latitude: number;
  longitude: number;
  type: LocationPointKind;
  admin0?: string;
  admin1?: string;
  admin2?: string;
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
  metadata?: LocationPointMetadata;
}

export type LocationFeatureProperties = LocationPointProperties;

export type LocationFeatureData = LocationFeatureProperties;

export interface LocationGroupItemData extends LocationPointProperties {}

export interface LocationRelationMeta {
  schemaVersion: 1;
  relationKind?: string;
  weight?: number;
  metadata?: Record<string, unknown>;
}

export interface LocationPeerData {
  schemaVersion: 1;
  lastProgress?: {
    stage: string;
    completed?: number;
    total?: number;
    updatedAt?: number;
  };
  lastError?: {
    message: string;
    code?: string;
  };
  metadata?: Record<string, unknown>;
}

export type LocationFeature = {
  nodeId: NodeId;
  id: LocationFeatureId;
  type: string;
  data: LocationFeatureProperties;
  mortonKey?: string;
  centroidForShapeId?: number;
  centroidForShapeContainerNodeId?: NodeId;
  updatedAt?: number;
};
