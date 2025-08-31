/**
 * @file RouteDataSourceDefinitions.ts
 * @description TypeScript definitions for route data sources based on README.md specifications
 */

/**
 * Base interface for all route data sources
 */
export interface RouteDataSourceBase {
  /** Unique identifier for the data source */
  id: string;
  /** Human-readable name */
  name: string;
  /** Base URL of the data source */
  baseUrl: string;
  /** License type */
  license: string;
  /** Update frequency */
  updateFrequency: 'realtime' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'irregular' | 'provider-dependent';
  /** Supported route types */
  supportedTypes: RouteType[];
  /** Available data attributes */
  availableAttributes: string[];
  /** API endpoint configuration */
  endpoints?: Record<string, string>;
  /** Default configuration options */
  defaultOptions?: Record<string, any>;
}

/**
 * Route types supported by data sources
 */
export type RouteType = 
  | 'all'           // All types
  | 'road'          // Road routes
  | 'railway'       // Railway routes
  | 'airway'        // Flight routes/airways
  | 'seaway'        // Sea routes
  | 'public-transit' // Public transportation routes
  | 'major-road'    // Major roads only
  | 'major-railway'; // Major railways only

/**
 * OpenStreetMap (Overpass API) data source definition for routes
 */
export const OpenStreetMapOverpassRouteDataSource: RouteDataSourceBase = {
  id: 'openstreetmap-overpass-route',
  name: 'OpenStreetMap (Overpass API)',
  baseUrl: 'https://overpass-api.de/',
  license: 'ODbL 1.0',
  updateFrequency: 'realtime',
  supportedTypes: ['all'],
  availableAttributes: [
    'name', 'ref', 'start_point', 'end_point', 'coordinates',
    'maxspeed', 'lanes', 'gauge'
  ],
  endpoints: {
    interpreter: 'https://overpass-api.de/api/interpreter'
  },
  defaultOptions: {
    format: 'json',
    timeout: 25
  }
};

/**
 * Natural Earth data source definition for routes
 */
export const NaturalEarthRouteDataSource: RouteDataSourceBase = {
  id: 'natural-earth-route',
  name: 'Natural Earth',
  baseUrl: 'https://www.naturalearthdata.com/',
  license: 'Public Domain',
  updateFrequency: 'irregular',
  supportedTypes: ['major-road', 'major-railway'],
  availableAttributes: [
    'name', 'type', 'sov_a3', 'coordinates', 'featurecla', 'min_zoom'
  ],
  endpoints: {
    download: 'https://www.naturalearthdata.com/http//www.naturalearthdata.com/download/'
  }
};

/**
 * OpenFlights data source definition for flight routes
 */
export const OpenFlightsRouteDataSource: RouteDataSourceBase = {
  id: 'openflights-route',
  name: 'OpenFlights',
  baseUrl: 'https://openflights.org/data.html',
  license: 'ODbL 1.0',
  updateFrequency: 'irregular',
  supportedTypes: ['airway'],
  availableAttributes: [
    'airline', 'src_airport', 'dst_airport', 'codeshare', 'stops', 'equipment'
  ],
  endpoints: {
    routes: 'https://raw.githubusercontent.com/jpatokal/openflights/master/data/routes.dat'
  }
};

/**
 * OpenSeaMap data source definition for sea routes
 */
export const OpenSeaMapRouteDataSource: RouteDataSourceBase = {
  id: 'openseamap-route',
  name: 'OpenSeaMap',
  baseUrl: 'https://www.openseamap.org/',
  license: 'ODbL 1.0',
  updateFrequency: 'monthly',
  supportedTypes: ['seaway'],
  availableAttributes: [
    'name', 'seamark:type', 'coordinates', 'status'
  ],
  endpoints: {
    api: 'https://www.openseamap.org/api/'
  }
};

/**
 * GTFS Static data source definition for public transit routes
 */
export const GTFSStaticRouteDataSource: RouteDataSourceBase = {
  id: 'gtfs-static-route',
  name: 'GTFS Static',
  baseUrl: 'https://gtfs.org/schedule/reference/',
  license: 'provider-dependent',
  updateFrequency: 'provider-dependent',
  supportedTypes: ['public-transit'],
  availableAttributes: [
    'route_short_name', 'route_long_name', 'route_type', 'shape_points'
  ],
  defaultOptions: {
    note: 'License and update frequency depend on individual transit providers'
  }
};

/**
 * OpenRailwayMap data source definition for railway routes
 */
export const OpenRailwayMapRouteDataSource: RouteDataSourceBase = {
  id: 'openrailwaymap-route',
  name: 'OpenRailwayMap',
  baseUrl: 'https://www.openrailwaymap.org/',
  license: 'ODbL 1.0',
  updateFrequency: 'realtime',
  supportedTypes: ['railway'],
  availableAttributes: [
    'name', 'ref', 'railway', 'electrified', 'gauge', 'maxspeed', 'usage'
  ],
  endpoints: {
    api: 'https://www.openrailwaymap.org/api/'
  }
};

/**
 * Collection of all available route data sources
 */
export const RouteDataSources: Record<string, RouteDataSourceBase> = {
  'openstreetmap-overpass-route': OpenStreetMapOverpassRouteDataSource,
  'natural-earth-route': NaturalEarthRouteDataSource,
  'openflights-route': OpenFlightsRouteDataSource,
  'openseamap-route': OpenSeaMapRouteDataSource,
  'gtfs-static-route': GTFSStaticRouteDataSource,
  'openrailwaymap-route': OpenRailwayMapRouteDataSource
};

/**
 * Get route data source by ID
 */
export function getRouteDataSource(id: string): RouteDataSourceBase | undefined {
  return RouteDataSources[id];
}

/**
 * Get route data sources by supported route type
 */
export function getRouteDataSourcesByType(routeType: RouteType): RouteDataSourceBase[] {
  return Object.values(RouteDataSources).filter(source => 
    source.supportedTypes.includes('all') || source.supportedTypes.includes(routeType)
  );
}

/**
 * Get route data sources by license type
 */
export function getRouteDataSourcesByLicense(license: string): RouteDataSourceBase[] {
  return Object.values(RouteDataSources).filter(source => 
    source.license === license
  );
}

/**
 * Get route data sources by update frequency
 */
export function getRouteDataSourcesByUpdateFrequency(frequency: string): RouteDataSourceBase[] {
  return Object.values(RouteDataSources).filter(source => 
    source.updateFrequency === frequency
  );
}