// Shared location store types extracted from location-plugin.
import type { CountryCode, ISO2, GroupEntity, NodeId, Timestamp, TreeNodeData } from '@hierarchidb/common-types';

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

export interface LocationEntity extends TreeNodeData {
  dataSource: LocationDataSource;
  licenseAgreement: boolean;
  licenseAgreedAt?: Timestamp;
  ideGsmFileName?: string;
  ideGsmSourceUrl?: string;
  selectedArrayByCountries: Record<ISO2, boolean[]>;
  tilesMinZoom?: number;
  tilesMaxZoom?: number;
  concurrentDownloads: number;
  lastProcessedAt?: Timestamp;
  processingStatus?: LocationProcessingStatus;
  processedAt?: Timestamp;
  tabularSourceId?: string;
  extractConfig?: Record<string, unknown>;
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
  kind: LocationPointKind;
  countryName?: string;
  countryCode: CountryCode;
  admin1?: string;
  admin2?: string;
  admin1Code?: string;
  admin2Code?: string;
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

export interface LocationPointInput {
  lon: number;
  lat: number;
  id?: string | number;
  ts?: number;
  properties?: Record<string, unknown>;
}

export interface LocationTileSettings {
  zoomMinGenerate: number;
  zoomMaxGenerate: number;
  zoomMaxServe?: number;
  attributeAllowlist?: string[];
  tileFeatureLimit?: number;
  extent?: number;
  inputFormat?: 'geojson' | 'flatgeobuf';
  inputCompression?: 'gzip' | 'none';
}

export interface SessionSummary {
  nodeId: NodeId;
  zoomMin: number;
  zoomMax: number;
  zoomMaxServe?: number;
  bbox: [number, number, number, number];
  totalPoints: number;
  layers: string[];
}

export interface UnifiedLocationBatchConfig {
  concurrency?: number;
  corsProxyBaseURL?: string;
  maxRetries?: number;
  maxConcurrentTasks?: number;
}

export interface LocationBatchData {
  points: LocationPointInput[];
  settings: LocationTileSettings;
}

export type BatchConfig = UnifiedLocationBatchConfig;

export type { CsvTable } from './csvUtils.js';
export { buildHeaderIndex, getColumnValue, parseCsvTable } from './csvUtils.js';
export type { IdeGsmParseResult } from './ideGsmCsv.js';
export { filterIdeGsmPointsBySelection, parseIdeGsmCsv } from './ideGsmCsv.js';

export {
  LocationDB,
  type LocationFeatureRow,
  type LocationRelationRow,
  type LocationSessionRecord,
  type PendingLocationSession,
  type VectorTileRecord,
  closeLocationDB,
  getLocationDB,
  getLocationDatabase,
  LocationDatabase,
  closeEphemeralLocationDB,
  getEphemeralLocationDB,
} from './EphemeralLocationDB.js';

export type { LocationMutationAPI, LocationQueryAPI } from '@hierarchidb/plugin-service-api';
