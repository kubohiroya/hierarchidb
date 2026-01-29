// Shared location store types extracted from location-plugin.
import type { CountryCode, ISO2, GroupEntity, NodeId, Timestamp, TreeNodeData } from '@hierarchidb/common-types';
import { digestSha256Hex } from '@hierarchidb/util';

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


export const LOCATION_POINT_ID_VERSION = 'v1';
export const LOCATION_POINT_ID_PRECISION = 5;
export const LOCATION_POINT_ID_PREFIX = `p:${LOCATION_POINT_ID_VERSION}`;

const locationPointTextEncoder = new TextEncoder();

const normalizeLocationPointCoord = (value: number): string => {
  const rounded = Number(value.toFixed(LOCATION_POINT_ID_PRECISION));
  return Number.isFinite(rounded) ? rounded.toFixed(LOCATION_POINT_ID_PRECISION) : '0.00000';
};

const encodeLocationPointKey = (lat: number, lon: number): Uint8Array => {
  const latKey = normalizeLocationPointCoord(lat);
  const lonKey = normalizeLocationPointCoord(lon);
  return locationPointTextEncoder.encode(`${latKey}|${lonKey}`);
};

export const buildLocationPointIdFromLatLon = async (
  lat: number,
  lon: number,
): Promise<LocationPointId> => {
  const hash = await digestSha256Hex(encodeLocationPointKey(lat, lon));
  return `${LOCATION_POINT_ID_PREFIX}:${hash}` as LocationPointId;
};

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

export interface LocationEntity extends TreeNodeData {
  dataSource: LocationDataSource;
  licenseAgreement: boolean;
  licenseAgreedAt?: Timestamp;
  ideGsmFileName?: string;
  ideGsmSourceUrl?: string;
  ideGsmSources?: IdeGsmSourceEntry[];
  ideGsmSelectionHash?: string;
  selectedArrayByCountries: Record<ISO2, boolean[]>;
  tilesMinZoom?: number;
  tilesMaxZoom?: number;
  concurrentDownloads: number;
  lastProcessedAt?: Timestamp;
  processingStatus?: LocationProcessingStatus;
  processedAt?: Timestamp;
  tabularSourceId?: string;
  extractConfig?: Record<string, unknown>;
  representationByZoomLevelConfig?: LocationRepresentationByZoomLevelConfig;
  iconConfig?: LocationIconConfig;
  labelConfig?: LocationLabelConfig;
}

export interface LocationBatchFilterCriteria {
  allowedTypes?: LocationType[];
  countryCodes?: CountryCode[];
  countryNames?: string[];
  excludeIds?: string[];
}

export interface LocationBatchProcessingOptions {
  concurrent: number;
  geocoding?: boolean;
  deduplicate?: boolean;
}

export interface LocationSearchOptions {
  nominatimEndpoint?: string;
  addressDetails?: boolean;
  extraTags?: boolean;
  nameDetails?: boolean;
  overpassEndpoint?: string;
  overpassTimeout?: number;
  [key: string]: unknown;
}

export interface LocationSearchConfig {
  dataSource: LocationDataSource;
  query?: string;
  countryCode?: CountryCode;
  countryName?: string;
  boundingBox?: [number, number, number, number];
  language?: string;
  limit?: number;
  types?: LocationType[];
  options?: LocationSearchOptions;
}

export interface LocationBatchConfig {
  searchConfigs: LocationSearchConfig[];
  concurrentDownloads?: number;
  processingOptions: LocationBatchProcessingOptions;
  filterCriteria?: LocationBatchFilterCriteria;
}

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

export interface LocationPoint extends GroupEntity<LocationPointId>, LocationPointProperties {
  nodeId: NodeId;
  type: 'locationPoint';
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

export interface LocationGroupItemData extends LocationPointProperties {}

export interface LocationRelationMeta {
  schemaVersion: 1;
  relationKind?: string;
  weight?: number;
  metadata?: Record<string, unknown>;
}

export type { CsvTable } from './csvUtils.js';
export { buildHeaderIndex, getColumnValue, parseCsvTable } from './csvUtils.js';
export {
  MORTON_KEY_HEX_LENGTH,
  MORTON_MAX_BITS,
  clampMortonZoom,
  lonLatToTileXY,
  formatTileId,
  buildTileIdByZoom,
  mortonKeyFromLonLat,
  mortonRangeForTile,
} from './morton.js';
export type { IdeGsmParseResult } from './ideGsmCsv.js';
export { filterIdeGsmPointsBySelection, parseIdeGsmCsv } from './ideGsmCsv.js';

export {
  LocationDB,
  type LocationFeature,
  type LocationRelation,
  closeLocationDB,
  getLocationDB,
  getLocationDatabase,
  LocationDatabase,
  closeEphemeralLocationDB,
  getEphemeralLocationDB,
} from './LocationDB.js';

export type { LocationMutationAPI, LocationQueryAPI } from '@hierarchidb/plugin-service-api';
