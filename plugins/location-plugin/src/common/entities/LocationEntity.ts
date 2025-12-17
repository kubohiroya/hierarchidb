/**
 * @file LocationEntity.ts
 * @description Location dataset entity definition and shared configuration types.
 */

import type { NodeId, Timestamp, TreeNodeData } from '@hierarchidb/common-types';

/**
 * Category taxonomy used when importing / classifying locations.
 * Trimmed for transportation/economic simulations.
 */
export type LocationCategory =
  | 'transportation'
  | 'administrative';

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
  | 'custom'
  | 'manual';

export interface LocationAddress {
  street?: string;
  houseNumber?: string;
  postcode?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  countryCode?: string;
}

export interface LocationAttributes {
  osmId?: string;
  osmType?: 'node' | 'way' | 'relation';
  tags?: Record<string, string>;
  categories?: LocationCategory[];
  sourceUrl?: string;
  wikidataId?: string;
  geonameId?: number;
  payload?: Record<string, unknown>;
}

export interface LocationFeature {
  id?: string;
  position: { lat: number; lon: number };
  kind?: LocationType | string;
  properties?: Record<string, unknown>;
  sourceId?: string;
}

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
  id: NodeId;

  /** Optional descriptive metadata mirrored to the TreeNode. */
  name?: string;
  description?: string;
  category?: LocationCategory;
  type?: LocationType;

  /** Data acquisition settings. */
  dataSource: LocationDataSource;
  licenseAgreement: boolean;
  licenseAgreedAt?: Timestamp;
  selectionMatrix: boolean[][];
  /** Optional tiling zoom range for batch downloads. */
  tilesMinZoom?: number;
  tilesMaxZoom?: number;
  concurrentDownloads: number;
  batchSessionId?: string;
  lastProcessedAt?: Timestamp;

  /** Derived / imported attributes. */
  boundingBox?: [number, number, number, number];
  address?: LocationAddress;
  attributes?: LocationAttributes;
  metadata?: Record<string, unknown>;
  importance?: number;
  processingStatus?: LocationProcessingStatus;
  processedAt?: Timestamp;
  /** Collection of points associated with this node (multi-point support). */
  features?: LocationFeature[];
  /** Tabular pipeline metadata (source storage ID and extract criteria). */
  tabularSourceId?: string;
  extractConfig?: Record<string, unknown>;
}

export type LocationDraft = Partial<LocationEntity> & {
  treeNodeId: NodeId;
  draft?: LocationEntity;
  originalVersion?: number;
};

/**
 * Additional filtering options for batch processing.
 */
export interface LocationBatchFilterCriteria {
  minImportance?: number;
  allowedCategories?: LocationCategory[];
  allowedTypes?: LocationType[];
  countryCodes?: string[];
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
  boundingBox?: [number, number, number, number];
  language?: string;
  limit?: number;
  types?: LocationType[];
  categories?: LocationCategory[];
  selectionMatrix?: boolean[][];
  options?: LocationSearchOptions;
}

export interface LocationBatchConfig {
  searchConfigs: LocationSearchConfig[];
  concurrentDownloads?: number;
  processingOptions: LocationBatchProcessingOptions;
  filterCriteria?: LocationBatchFilterCriteria;
}
