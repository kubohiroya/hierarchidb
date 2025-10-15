/**
 * Location plugin: Data source definitions
 * These are defined locally to the plugin as requested. Do not import from UI package.
 */

export type LocationDataSourceCategory = 'location';

export interface LocationDataSourceConfig {
  name: string;
  displayName: string;
  description: string;
  license: string;
  licenseUrl: string;
  attribution: string;
  website: string;
  maxAdminLevel: number;
  category: LocationDataSourceCategory; // always 'location'
  licenseType: 'public' | 'odbl' | 'cc' | 'mit' | 'academic' | 'commercial' | 'varies';
}

/**
 * Default location data sources provided by this plugin
 */
export const LOCATION_DATA_SOURCES: ReadonlyArray<LocationDataSourceConfig> = [
  {
    name: 'naturalearth-populated-places',
    displayName: 'Natural Earth Populated Places',
    description: 'Major cities and populated places worldwide',
    license: 'Public Domain',
    licenseUrl: 'https://www.naturalearthdata.com/about/terms-of-use/',
    attribution: 'Made with Natural Earth',
    website: 'https://www.naturalearthdata.com/',
    maxAdminLevel: 0,
    category: 'location',
    licenseType: 'public',
  },
  {
    name: 'ourairports',
    displayName: 'OurAirports',
    description: 'Global airport database with IATA/ICAO codes',
    license: 'Open Database License (ODbL)',
    licenseUrl: 'https://ourairports.com/about.html#license',
    attribution: '© OurAirports contributors',
    website: 'https://ourairports.com/',
    maxAdminLevel: 0,
    category: 'location',
    licenseType: 'odbl',
  },
  {
    name: 'world-port-index',
    displayName: 'World Port Index',
    description: 'Major ports worldwide from US government data',
    license: 'Public Domain',
    licenseUrl: 'https://msi.nga.mil/Publications/WPI',
    attribution: 'Data from World Port Index (NGA)',
    website: 'https://msi.nga.mil/Publications/WPI',
    maxAdminLevel: 0,
    category: 'location',
    licenseType: 'public',
  },
] as const;

export default LOCATION_DATA_SOURCES;
