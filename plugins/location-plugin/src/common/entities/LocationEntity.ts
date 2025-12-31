/**
 * @file LocationEntity.ts
 * @description Location dataset entity definition and shared configuration types.
 */

import type { Timestamp, TreeNodeData } from '@hierarchidb/common-types';

/**
 * Location types recognised by batch download/normalizer routines.
 * Trimmed to the core set needed for economic/transport simulations.
 */
export type LocationType =
  | 'area_centroid'
  | 'airport'
  | 'port'
  | 'railway_station'
  | 'interchange';

/**
 * Supported location data sources.
 */
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
  | 'failed'
  | 'cancelled';

/**
 * Dataset-level entity persisted in Dexie.
 * Contains both acquisition settings and the latest processing status.
 */
export interface LocationEntity extends TreeNodeData {
  /** Data acquisition settings. */
  dataSource: LocationDataSource;
  licenseAgreement: boolean;
  licenseAgreedAt?: Timestamp;
  ideGsmFileName?: string;
  ideGsmSourceUrl?: string;
  selectedArrayByCountries: Record<string, boolean[]>;

  /** Optional tiling zoom range for batch downloads. */
  tilesMinZoom?: number;
  tilesMaxZoom?: number;
  /** Number of workers used for vector tile generation. */
  tileWorkers?: number;
  concurrentDownloads: number;
  batchSessionId?: string;
  lastProcessedAt?: Timestamp;

  processingStatus?: LocationProcessingStatus;
  processedAt?: Timestamp;
  /** Tabular pipeline metadata (source storage ID and extract criteria). */
  tabularSourceId?: string;
  extractConfig?: Record<string, unknown>;
}

/**
 * Additional filtering options for batch processing.
 */
export interface LocationBatchFilterCriteria {
  allowedTypes?: LocationType[];
  countryCodes?: string[];
  countryNames?: string[];
  excludeIds?: string[];
}

export interface LocationBatchProcessingOptions {
  /** Maximum concurrent tasks when resolving batches. */
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
  countryCode?: string;
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
