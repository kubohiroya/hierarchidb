/**
 * Common Data Source Types for Geographic Plugins
 * Base types shared by shape, location, and route plugin-loader
 */
export type ISO2 = string;
export type ISO3 = string;
export type CountryCode = ISO2 | ISO3;

export type DataSourceName = 'naturalearth' | 'geoboundaries' | 'gadm' | 'openstreetmap';

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
  dataSourceName: DataSourceName;
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
