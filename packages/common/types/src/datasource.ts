/**
 * Common Data Source Types for Geographic Plugins
 * Base types shared by shape, location, and route plugins
 */

/**
 * Base data source configuration
 * Common properties for all geographic data sources
 */
export interface BaseDataSourceConfig {
  // Identity
  name: string;
  displayName: string;
  description: string;
  
  // License information
  license: string;
  licenseUrl: string;
  attribution: string;
  
  // UI presentation
  color: string;
  icon: string;
  
  // Coverage
  supportedCountries?: string[];
}

/**
 * Shape-specific data source configuration
 * For administrative boundaries and regions
 */
export interface ShapeDataSourceConfig extends BaseDataSourceConfig {
  type: 'shape';
  maxAdminLevel: number;
  dataSourceName: 'naturalearth' | 'geoboundaries' | 'gadm' | 'openstreetmap';
}

/**
 * Location-specific data source configuration
 * For points of interest and facilities
 */
export interface LocationDataSourceConfig extends BaseDataSourceConfig {
  type: 'location';
  locationTypes: LocationType[];
  dataSourceName: 'openstreetmap' | 'geonames' | 'wikidata' | 'overpass';
}

/**
 * Route-specific data source configuration
 * For transportation networks and paths
 */
export interface RouteDataSourceConfig extends BaseDataSourceConfig {
  type: 'route';
  routeTypes: RouteType[];
  dataSourceName: 'openstreetmap' | 'openrouteservice' | 'graphhopper' | 'overpass';
}

/**
 * Union type for all data source configurations
 */
export type DataSourceConfig = 
  | ShapeDataSourceConfig 
  | LocationDataSourceConfig 
  | RouteDataSourceConfig;

/**
 * Location types for location plugin
 */
export type LocationType = 
  | 'administrative_center'  // 行政の中心地
  | 'airport'                // 空港
  | 'port'                   // 港
  | 'railway_station'        // 鉄道駅
  | 'highway_interchange';   // インターチェンジ

/**
 * Route types for route plugin
 */
export type RouteType = 
  | 'airway'        // 空路
  | 'seaway'        // 海路（運河）
  | 'road'          // 道路
  | 'railway'       // 鉄道
  | 'high_speed_rail'; // 高速鉄道

/**
 * Common country metadata
 */
export interface CountryMetadata {
  countryCode: string;
  countryName: string;
  continent: string;
  population?: number;
  area?: number;
  dataQuality?: 'high' | 'medium' | 'low';
}

/**
 * Shape-specific country metadata
 */
export interface ShapeCountryMetadata extends CountryMetadata {
  availableAdminLevels: number[];
}

/**
 * Location-specific country metadata
 */
export interface LocationCountryMetadata extends CountryMetadata {
  availableLocationTypes: LocationType[];
  totalLocations?: number;
}

/**
 * Route-specific country metadata
 */
export interface RouteCountryMetadata extends CountryMetadata {
  availableRouteTypes: RouteType[];
  totalRouteLength?: number;
}

/**
 * Base URL metadata for data download
 */
export interface BaseUrlMetadata {
  url: string;
  countryCode: string;
  continent: string;
  estimatedSize?: number;
  lastUpdated?: string;
}

/**
 * Shape-specific URL metadata
 */
export interface ShapeUrlMetadata extends BaseUrlMetadata {
  adminLevel: number;
  dataSource: string;
}

/**
 * Location-specific URL metadata
 */
export interface LocationUrlMetadata extends BaseUrlMetadata {
  locationType: LocationType;
  estimatedCount?: number;
  scope?: 'national' | 'international' | 'regional' | 'global';
}

/**
 * Route-specific URL metadata  
 */
export interface RouteUrlMetadata extends BaseUrlMetadata {
  routeType: RouteType;
  estimatedLength?: number;
  scope?: 'national' | 'international' | 'regional' | 'global';
}

/**
 * License agreement tracking
 */
export interface LicenseAgreement {
  dataSourceName: string;
  agreed: boolean;
  agreedAt?: string;
  version?: string;
}

/**
 * Selection matrix for UI
 * Generic type that can be specialized for each plugin
 */
export interface SelectionMatrix<T> {
  rows: SelectionRow<T>[];
  columns: SelectionColumn[];
  state: boolean[][];
}

export interface SelectionRow<T> {
  id: string;
  label: string;
  data: T;
}

export interface SelectionColumn {
  id: string;
  label: string;
  description?: string;
}

/**
 * Shape selection matrix row data
 */
export interface ShapeSelectionRowData {
  countryCode: string;
  countryName: string;
  continent: string;
}

/**
 * Location selection matrix row data
 */
export interface LocationSelectionRowData {
  countryCode: string;
  countryName: string;
  continent: string;
}

/**
 * Route selection matrix row data
 */
export interface RouteSelectionRowData {
  countryCode: string;
  countryName: string;
  continent: string;
}