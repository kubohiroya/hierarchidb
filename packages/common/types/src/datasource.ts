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
