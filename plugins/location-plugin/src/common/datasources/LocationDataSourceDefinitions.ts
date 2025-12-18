/**
 * @file LocationDataSourceDefinitions.ts
 * @description TypeScript definitions for location data sources based on README.md specifications
 */

/**
 * Base interface for all location data sources
 */
export interface LocationDataSourceBase {
  /** Unique identifier for the data source */
  id: string;
  /** Human-readable name */
  name: string;
  /** Optional display name for UI */
  displayName?: string;
  /** Optional description for UI */
  description?: string;
  /** Base URL of the data source */
  baseUrl: string;
  /** Landing page / docs */
  website?: string;
  /** License type */
  license: string;
  /** License reference URL */
  licenseUrl?: string;
  /** Attribution string required by the provider */
  attribution?: string;
  /** License classification for UI */
  licenseType?: 'public' | 'odbl' | 'cc' | 'mit' | 'academic' | 'commercial' | 'varies';
  /** Update frequency */
  updateFrequency: 'realtime' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'irregular';
  /** Supported location types */
  supportedTypes: LocationType[];
  /** Available data attributes */
  availableAttributes: string[];
  /** Optional maximum admin level covered */
  maxAdminLevel?: number;
  /** Category */
  category?: 'location';
  /** API endpoint configuration */
  endpoints?: Record<string, string>;
  /** Default configuration options */
  defaultOptions?: Record<string, unknown>;
}

/**
 * Location types supported by data sources
 */
export type LocationType =
  | 'all'           // All types
  | 'administrative' // Administrative centers
  | 'airport'       // Airports
  | 'port'          // Ports/harbors
  | 'station'       // Railway stations
  | 'government'    // Government facilities
  | 'commercial'    // Commercial facilities
  | 'natural'       // Natural features;

/**
 * OpenStreetMap (Overpass API) data source definition
 */
export const OpenStreetMapOverpassDataSource: LocationDataSourceBase = {
  id: 'openstreetmap-overpass',
  name: 'OpenStreetMap (Overpass API)',
  displayName: 'OpenStreetMap (Overpass API)',
  baseUrl: 'https://overpass-api.de/',
  website: 'https://overpass-api.de/',
  license: 'ODbL 1.0',
  licenseUrl: 'https://opendatacommons.org/licenses/odbl/',
  attribution: '© OpenStreetMap contributors',
  licenseType: 'odbl',
  updateFrequency: 'realtime',
  supportedTypes: ['all'],
  availableAttributes: [
    'name', 'name:en', 'name:ja', 'lat', 'lon',
    'amenity', 'aeroway', 'railway', 'highway', 'place',
  ],
  description: 'Query OSM points via Overpass API',
  maxAdminLevel: 0,
  category: 'location',
  endpoints: {
    interpreter: 'https://overpass-api.de/api/interpreter',
  },
  defaultOptions: {
    format: 'json',
    timeout: 25,
  },
};

/**
 * OpenStreetMap (Nominatim) data source definition
 */
export const OpenStreetMapNominatimDataSource: LocationDataSourceBase = {
  id: 'openstreetmap-nominatim',
  name: 'OpenStreetMap (Nominatim)',
  displayName: 'OpenStreetMap (Nominatim)',
  baseUrl: 'https://nominatim.openstreetmap.org/',
  website: 'https://nominatim.openstreetmap.org/',
  license: 'ODbL 1.0',
  licenseUrl: 'https://opendatacommons.org/licenses/odbl/',
  attribution: '© OpenStreetMap contributors',
  licenseType: 'odbl',
  updateFrequency: 'realtime',
  supportedTypes: ['all'],
  availableAttributes: [
    'display_name', 'lat', 'lon', 'place_id', 'osm_type', 'osm_id',
    'class', 'type', 'importance', 'boundingbox',
  ],
  description: 'Geocoding and place search from OSM',
  maxAdminLevel: 0,
  category: 'location',
  endpoints: {
    search: 'https://nominatim.openstreetmap.org/search',
  },
  defaultOptions: {
    format: 'json',
    limit: 50,
    addressdetails: 1,
  },
};

/**
 * GeoNames data source definition
 */
export const GeoNamesDataSource: LocationDataSourceBase = {
  id: 'geonames',
  name: 'GeoNames',
  displayName: 'GeoNames',
  baseUrl: 'https://www.geonames.org/',
  website: 'https://www.geonames.org/',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  attribution: 'Data provided by GeoNames',
  licenseType: 'cc',
  updateFrequency: 'daily',
  supportedTypes: ['all'],
  availableAttributes: [
    'name', 'asciiname', 'alternatenames', 'latitude', 'longitude',
    'feature_class', 'feature_code', 'country_code', 'admin1_code',
    'population', 'elevation',
  ],
  description: 'Worldwide place names with attributes and population',
  maxAdminLevel: 0,
  category: 'location',
  endpoints: {
    api: 'http://api.geonames.org/',
    search: 'http://api.geonames.org/searchJSON',
  },
  defaultOptions: {
    maxRows: 100,
    style: 'full',
  },
};

/**
 * Natural Earth data source definition
 */
export const NaturalEarthDataSource: LocationDataSourceBase = {
  id: 'natural-earth',
  name: 'Natural Earth',
  displayName: 'Natural Earth Populated Places',
  description: 'Major cities and populated places worldwide',
  baseUrl: 'https://www.naturalearthdata.com/',
  website: 'https://www.naturalearthdata.com/',
  license: 'Public Domain',
  licenseUrl: 'https://www.naturalearthdata.com/about/terms-of-use/',
  attribution: 'Map data by Natural Earth',
  licenseType: 'public',
  updateFrequency: 'irregular',
  supportedTypes: ['administrative', 'airport', 'port'],
  availableAttributes: [
    'name', 'nameascii', 'latitude', 'longitude', 'scalerank',
    'featurecla', 'adm0name', 'adm1name',
  ],
  maxAdminLevel: 0,
  category: 'location',
  endpoints: {
    download: 'https://www.naturalearthdata.com/http//www.naturalearthdata.com/download/',
  },
};

/**
 * OurAirports data source definition
 */
export const OurAirportsDataSource: LocationDataSourceBase = {
  id: 'ourairports',
  name: 'OurAirports',
  displayName: 'OurAirports',
  description: 'Global airport database with IATA/ICAO codes',
  baseUrl: 'https://ourairports.com/data/',
  website: 'https://ourairports.com/',
  license: 'Public Domain',
  licenseUrl: 'https://ourairports.com/data/',
  attribution: 'Data courtesy of OurAirports.com',
  licenseType: 'odbl',
  updateFrequency: 'weekly',
  supportedTypes: ['airport'],
  availableAttributes: [
    'ident', 'name', 'latitude_deg', 'longitude_deg', 'elevation_ft',
    'type', 'municipality', 'iso_country', 'iso_region',
  ],
  maxAdminLevel: 0,
  category: 'location',
  endpoints: {
    airports: 'https://davidmegginson.github.io/ourairports-data/airports.csv',
  },
};

/**
 * OpenFlights data source definition
 */
export const OpenFlightsDataSource: LocationDataSourceBase = {
  id: 'openflights',
  name: 'OpenFlights',
  displayName: 'OpenFlights',
  description: 'Airport database from the OpenFlights project',
  baseUrl: 'https://openflights.org/data.html',
  website: 'https://openflights.org/data.html',
  license: 'ODbL 1.0',
  licenseUrl: 'https://opendatacommons.org/licenses/odbl/',
  attribution: 'OpenFlights project',
  licenseType: 'odbl',
  updateFrequency: 'irregular',
  supportedTypes: ['airport', 'station'],
  availableAttributes: [
    'name', 'city', 'country', 'IATA', 'ICAO', 'latitude',
    'longitude', 'altitude', 'timezone', 'DST',
  ],
  maxAdminLevel: 0,
  category: 'location',
  endpoints: {
    airports: 'https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat',
  },
};

/**
 * World Port Index data source definition
 */
export const WorldPortIndexDataSource: LocationDataSourceBase = {
  id: 'world-port-index',
  name: 'World Port Index',
  displayName: 'World Port Index',
  description: 'Major ports worldwide from US government data',
  baseUrl: 'https://msi.nga.mil/Publications/WPI',
  website: 'https://msi.nga.mil/Publications/WPI',
  license: 'Public Domain',
  licenseUrl: 'https://msi.nga.mil/Publications/WPI',
  attribution: 'World Port Index (U.S. National Geospatial-Intelligence Agency)',
  licenseType: 'public',
  updateFrequency: 'yearly',
  supportedTypes: ['port'],
  availableAttributes: [
    'port_name', 'country', 'latitude', 'longitude', 'harbor_size',
    'harbor_type', 'shelter', 'tide_range',
  ],
  maxAdminLevel: 0,
  category: 'location',
};

/**
 * Collection of all available location data sources
 */
export const LocationDataSources: Record<string, LocationDataSourceBase> = {
  'openstreetmap-overpass': OpenStreetMapOverpassDataSource,
  'openstreetmap-nominatim': OpenStreetMapNominatimDataSource,
  'geonames': GeoNamesDataSource,
  'natural-earth': NaturalEarthDataSource,
  'ourairports': OurAirportsDataSource,
  'openflights': OpenFlightsDataSource,
  'world-port-index': WorldPortIndexDataSource,
};

/**
 * Get data source by ID
 */
export function getLocationDataSource(id: string): LocationDataSourceBase | undefined {
  return LocationDataSources[id];
}

/**
 * Get data sources by supported location type
 */
export function getLocationDataSourcesByType(locationType: LocationType): LocationDataSourceBase[] {
  return Object.values(LocationDataSources).filter(source =>
    source.supportedTypes.includes('all') || source.supportedTypes.includes(locationType),
  );
}

/**
 * Get data sources by license type
 */
export function getLocationDataSourcesByLicense(license: string): LocationDataSourceBase[] {
  return Object.values(LocationDataSources).filter(source =>
    source.license === license,
  );
}
