/**
 * @file LocationEntity.ts
 * @description Location entity definition extending Shape plugin
 */

import type { 
  NodeId, 
  EntityId, 
  BaseEntity,
  Timestamp 
} from '@hierarchidb/common-type';

/**
 * Location type categories
 */
export type LocationCategory = 
  | 'transportation'  // 交通関連施設
  | 'administrative' // 行政施設
  | 'infrastructure' // インフラ施設
  | 'commercial'     // 商業施設
  | 'education'      // 教育施設
  | 'healthcare'     // 医療施設
  | 'leisure'        // レジャー施設
  | 'cultural'       // 文化施設
  | 'religious'      // 宗教施設
  | 'natural';       // 自然地形

/**
 * Specific location types
 */
export type LocationType = 
  // Transportation
  | 'airport'
  | 'railway_station'
  | 'bus_stop'
  | 'port'
  | 'parking'
  // Administrative
  | 'government'
  | 'embassy'
  | 'courthouse'
  // Healthcare
  | 'hospital'
  | 'clinic'
  | 'pharmacy'
  // Education
  | 'school'
  | 'university'
  | 'library'
  // Commercial
  | 'shopping_mall'
  | 'supermarket'
  | 'restaurant'
  | 'hotel'
  | 'bank'
  // Cultural
  | 'museum'
  | 'theater'
  | 'monument'
  // Leisure
  | 'park'
  | 'stadium'
  | 'beach'
  // Natural
  | 'mountain'
  | 'lake'
  | 'river';

/**
 * Data source for location data
 */
export type LocationDataSource = 
  | 'openstreetmap'  // OpenStreetMap Nominatim/Overpass
  | 'geonames'       // GeoNames database
  | 'wikidata'       // Wikidata SPARQL
  | 'overpass'       // Overpass API
  | 'custom'         // Custom data source
  | 'manual';        // Manually created

/**
 * Location point with metadata
 */
export interface LocationPoint {
  coordinates: [number, number]; // [longitude, latitude]
  elevation?: number;             // Elevation in meters
  accuracy?: number;              // Position accuracy in meters
  source?: LocationDataSource;   // Data source
  timestamp?: number;             // Last updated timestamp
}

/**
 * Location attributes from data sources
 */
export interface LocationAttributes {
  // OSM-specific
  osmId?: string;
  osmType?: 'node' | 'way' | 'relation';
  osmTags?: Record<string, string>;
  
  // GeoNames-specific
  geonameId?: number;
  featureClass?: string;
  featureCode?: string;
  population?: number;
  
  // Wikidata-specific
  wikidataId?: string;
  wikipediaUrl?: string;
  
  // Common attributes
  alternateNames?: string[];
  website?: string;
  phone?: string;
  email?: string;
  openingHours?: string;
  capacity?: number;
  rating?: number;
}

/**
 * Location entity extending base and metadata entities
 */
export interface LocationEntity extends BaseEntity {
  // Entity ID
  id: EntityId;
  nodeId: NodeId;
  
  // Basic information
  name: string;
  description?: string;
  category: LocationCategory;
  type: LocationType;
  // Note: Tags are managed by Folder plugin, not stored here
  
  // Metadata fields
  metadata?: Record<string, any>;
  customFields?: Record<string, any>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  version: number;
  
  // Geographic information
  point: LocationPoint;
  boundingBox?: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  area?: number;                // Area in square meters
  perimeter?: number;            // Perimeter in meters
  
  // Address information
  address?: {
    street?: string;
    houseNumber?: string;
    postcode?: string;
    city?: string;
    district?: string;
    state?: string;
    country?: string;
    countryCode?: string;
  };
  
  // Data source information
  dataSource: LocationDataSource;
  dataSourceId?: string;
  attributes?: LocationAttributes;
  licenseAgreement: boolean;
  licenseAgreedAt?: number;
  
  // Relations to other locations
  parentLocationId?: NodeId;     // Parent location (e.g., city for a building)
  childLocationIds?: NodeId[];   // Child locations
  nearbyLocationIds?: NodeId[];  // Nearby related locations
  
  // Shape plugin integration
  relatedShapeId?: EntityId;     // Associated Shape entity
  isShapeAnchor?: boolean;       // Is this a key point for shapes
  
  // Processing metadata
  processedAt?: number;
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  processingError?: string;
  geocodingConfidence?: number;  // 0-1 confidence score
  
  // Visualization properties
  icon?: {
    type: 'marker' | 'circle' | 'icon';
    icon?: string;              // Icon name or URL
    color?: string;
    size?: number;
    anchor?: [number, number];  // Icon anchor point
  };
  
  // Clustering configuration
  clusterGroup?: string;         // Clustering group identifier
  clusterPriority?: number;      // Priority in cluster (higher = more important)
  
  // Search and filtering
  searchKeywords?: string[];     // Additional search keywords
  importance?: number;           // Importance score (0-1)
  visibility?: {
    minZoom?: number;
    maxZoom?: number;
    condition?: string;         // Display condition expression
  };
}

/**
 * Location working copy for editing
 */
export interface LocationWorkingCopy extends LocationEntity {
  id: EntityId;
  nodeId: NodeId;
  isDraft: boolean;
  copiedAt?: number;
  originalVersion?: number;
  modifiedFields?: string[];
  
  // UI state for wizard
  selectedCountries?: string[];
  selectedTypes?: LocationType[];
  checkboxState?: Record<string, boolean>;
  searchRadius?: number;
  maxResults?: number;
}

/**
 * Metadata search criteria
 */
export interface MetadataSearchCriteria {
  metadata?: Record<string, any>;
}

/**
 * Location filter criteria
 */
export interface LocationFilterCriteria extends MetadataSearchCriteria {
  categories?: LocationCategory[];
  types?: LocationType[];
  dataSources?: LocationDataSource[];
  countries?: string[];
  cities?: string[];
  boundingBox?: [number, number, number, number];
  nearPoint?: {
    coordinates: [number, number];
    radius: number; // In meters
  };
  minImportance?: number;
  hasAddress?: boolean;
  hasAttributes?: boolean;
  parentLocationId?: NodeId;
  processingStatus?: string;
}

/**
 * Location search configuration
 */
export interface LocationSearchConfig {
  dataSource: LocationDataSource;
  query?: string;
  types?: LocationType[];
  boundingBox?: [number, number, number, number];
  limit?: number;
  language?: string;
  includeDetails?: boolean;
  options?: {
    // OSM Nominatim options
    nominatimEndpoint?: string;
    addressDetails?: boolean;
    extraTags?: boolean;
    nameDetails?: boolean;
    
    // Overpass options
    overpassEndpoint?: string;
    overpassQuery?: string;
    timeout?: number;
    
    // GeoNames options
    geonamesUsername?: string;
    featureClass?: string[];
    
    // Custom options
    customEndpoint?: string;
    customHeaders?: Record<string, string>;
  };
}

/**
 * Location statistics
 */
export interface LocationStatistics {
  totalLocations: number;
  byCategory: Record<LocationCategory, number>;
  byType: Record<LocationType, number>;
  byDataSource: Record<LocationDataSource, number>;
  byCountry: Record<string, number>;
  averageImportance: number;
  boundingBox?: [number, number, number, number];
  processingStats: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
}

/**
 * Batch processing configuration for locations
 */
export interface LocationBatchConfig {
  searchConfigs: LocationSearchConfig[];
  processingOptions: {
    concurrent: number;
    retryAttempts: number;
    timeout: number;
    deduplication: boolean;
    geocoding: boolean;
    clustering: boolean;
  };
  filterCriteria?: LocationFilterCriteria;
  outputFormat?: 'geojson' | 'csv' | 'json';
}