/**
 * Common Data Source Types for Geographic Plugins
 * Base types shared by shape, location, and route plugin-loader
 */

/**
 * Base data source configuration
 * Common properties for all geographic data sources
 */
/**
 * @deprecated Unused across the repository; scheduled for removal.
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
/**
 * @deprecated Unused across the repository; scheduled for removal.
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
/**
 * @deprecated Unused across the repository; scheduled for removal.
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
/**
 * @deprecated Unused across the repository; scheduled for removal.
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
  | 'administrative_center'
  | 'airport'
  | 'port'
  | 'railway_station'
  | 'highway_interchange';
/**
 * Route types for route plugin
 */
export type RouteType = 'airway' | 'seaway' | 'road' | 'railway' | 'high_speed_rail';

/**
 * Common country metadata
 */
export interface CountryMetadata {
  countryCode: string;
  countryName: string;
  continent: string;
  bbox?: [number, number, number, number];
  population?: number;
  area?: number;
  dataQuality?: 'high' | 'medium' | 'low';
}

/**
 * Shape-specific country metadata
 */
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface ShapeCountryMetadata extends CountryMetadata {
  availableAdminLevels: number[];
}

/**
 * Location-specific country metadata
 */
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface LocationCountryMetadata extends CountryMetadata {
  availableLocationTypes: LocationType[];
  totalLocations?: number;
}

/**
 * Route-specific country metadata
 */
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface RouteCountryMetadata extends CountryMetadata {
  availableRouteTypes: RouteType[];
  totalRouteLength?: number;
}

/**
 * Base URL metadata for data download
 */
/**
 * @deprecated Unused across the repository; scheduled for removal.
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
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface ShapeUrlMetadata extends BaseUrlMetadata {
  adminLevel: number;
  dataSource: string;
}

/**
 * Location-specific URL metadata
 */
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface LocationUrlMetadata extends BaseUrlMetadata {
  locationType: LocationType;
  estimatedCount?: number;
  scope?: 'national' | 'international' | 'regional' | 'global';
}

/**
 * Route-specific URL metadata
 */
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface RouteUrlMetadata extends BaseUrlMetadata {
  routeType: RouteType;
  estimatedLength?: number;
  scope?: 'national' | 'international' | 'regional' | 'global';
}

/**
 * License agreement tracking
 */
/**
 * @deprecated Unused across the repository; scheduled for removal.
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

/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface SelectionRow<T> {
  id: string;
  label: string;
  data: T;
}

/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface SelectionColumn {
  id: string;
  label: string;
  description?: string;
}

/**
 * Shape selection matrix row data
 */
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface ShapeSelectionRowData {
  countryCode: string;
  countryName: string;
  continent: string;
}

/**
 * Location selection matrix row data
 */
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface LocationSelectionRowData {
  countryCode: string;
  countryName: string;
  continent: string;
}

/**
 * Route selection matrix row data
 */
/**
 * @deprecated Unused across the repository; scheduled for removal.
 */
export interface RouteSelectionRowData {
  countryCode: string;
  countryName: string;
  continent: string;
}
