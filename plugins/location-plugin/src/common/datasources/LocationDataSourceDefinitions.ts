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
  /** Base URL of the data source */
  baseUrl: string;
  /** License type */
  license: string;
  /** License reference URL */
  licenseUrl?: string;
  /** Attribution string required by the provider */
  attribution?: string;
  /** Update frequency */
  updateFrequency: 'realtime' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'irregular';
  /** Supported location types */
  supportedTypes: LocationType[];
  /** Available data attributes */
  availableAttributes: string[];
  /** API endpoint configuration */
  endpoints?: Record<string, string>;
  /** Default configuration options */
  defaultOptions?: Record<string, any>;
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
  baseUrl: 'https://overpass-api.de/',
  license: 'ODbL 1.0',
  licenseUrl: 'https://opendatacommons.org/licenses/odbl/',
  attribution: '© OpenStreetMap contributors',
  updateFrequency: 'realtime',
  supportedTypes: ['all'],
  availableAttributes: [
    'name', 'name:en', 'name:ja', 'lat', 'lon',
    'amenity', 'aeroway', 'railway', 'highway', 'place',
  ],
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
  baseUrl: 'https://nominatim.openstreetmap.org/',
  license: 'ODbL 1.0',
  licenseUrl: 'https://opendatacommons.org/licenses/odbl/',
  attribution: '© OpenStreetMap contributors',
  updateFrequency: 'realtime',
  supportedTypes: ['all'],
  availableAttributes: [
    'display_name', 'lat', 'lon', 'place_id', 'osm_type', 'osm_id',
    'class', 'type', 'importance', 'boundingbox',
  ],
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
  baseUrl: 'https://www.geonames.org/',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  attribution: 'Data provided by GeoNames',
  updateFrequency: 'daily',
  supportedTypes: ['all'],
  availableAttributes: [
    'name', 'asciiname', 'alternatenames', 'latitude', 'longitude',
    'feature_class', 'feature_code', 'country_code', 'admin1_code',
    'population', 'elevation',
  ],
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
  baseUrl: 'https://www.naturalearthdata.com/',
  license: 'Public Domain',
  licenseUrl: 'https://www.naturalearthdata.com/about/terms-of-use/',
  attribution: 'Map data by Natural Earth',
  updateFrequency: 'irregular',
  supportedTypes: ['administrative', 'airport', 'port'],
  availableAttributes: [
    'name', 'nameascii', 'latitude', 'longitude', 'scalerank',
    'featurecla', 'adm0name', 'adm1name',
  ],
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
  baseUrl: 'https://ourairports.com/data/',
  license: 'Public Domain',
  licenseUrl: 'https://ourairports.com/data/',
  attribution: 'Data courtesy of OurAirports.com',
  updateFrequency: 'weekly',
  supportedTypes: ['airport'],
  availableAttributes: [
    'ident', 'name', 'latitude_deg', 'longitude_deg', 'elevation_ft',
    'type', 'municipality', 'iso_country', 'iso_region',
  ],
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
  baseUrl: 'https://openflights.org/data.html',
  license: 'ODbL 1.0',
  licenseUrl: 'https://opendatacommons.org/licenses/odbl/',
  attribution: 'OpenFlights project',
  updateFrequency: 'irregular',
  supportedTypes: ['airport', 'station'],
  availableAttributes: [
    'name', 'city', 'country', 'IATA', 'ICAO', 'latitude',
    'longitude', 'altitude', 'timezone', 'DST',
  ],
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
  baseUrl: 'https://msi.nga.mil/Publications/WPI',
  license: 'Public Domain',
  licenseUrl: 'https://msi.nga.mil/Publications/WPI',
  attribution: 'World Port Index (U.S. National Geospatial-Intelligence Agency)',
  updateFrequency: 'yearly',
  supportedTypes: ['port'],
  availableAttributes: [
    'port_name', 'country', 'latitude', 'longitude', 'harbor_size',
    'harbor_type', 'shelter', 'tide_range',
  ],
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
