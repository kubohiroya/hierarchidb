/**
 * Route plugin: Data source definitions
 */

export type RouteDataSourceCategory = 'route';

export interface RouteDataSourceConfig {
  name: string;
  displayName: string;
  description: string;
  license: string;
  licenseUrl: string;
  attribution: string;
  website: string;
  maxAdminLevel: number;
  category: RouteDataSourceCategory; // always 'route'
  licenseType: 'public' | 'odbl' | 'cc' | 'mit' | 'academic' | 'commercial' | 'varies';
}

export const ROUTE_DATA_SOURCES: ReadonlyArray<RouteDataSourceConfig> = [
  {
    name: 'openflights',
    displayName: 'OpenFlights',
    description: 'Flight route data between airports worldwide',
    license: 'Open Database License (ODbL)',
    licenseUrl: 'https://openflights.org/data.html#license',
    attribution: '© OpenFlights contributors',
    website: 'https://openflights.org/',
    maxAdminLevel: 0,
    category: 'route',
    licenseType: 'odbl',
  },
  {
    name: 'transitland',
    displayName: 'Transitland',
    description: 'GTFS feeds from transit operators worldwide',
    license: 'Varies by operator',
    licenseUrl: 'https://www.transit.land/documentation/licenses/',
    attribution: 'Data from Transitland operators',
    website: 'https://www.transit.land/',
    maxAdminLevel: 0,
    category: 'route',
    licenseType: 'varies',
  },
  {
    name: 'searoute-js',
    displayName: 'searoute-js',
    description: 'Calculated maritime routes between ports',
    license: 'MIT',
    licenseUrl: 'https://github.com/eurostat/searoute-js/blob/master/LICENSE',
    attribution: 'Routes calculated by searoute-js',
    website: 'https://github.com/eurostat/searoute-js',
    maxAdminLevel: 0,
    category: 'route',
    licenseType: 'mit',
  },
  {
    name: 'naturalearth-rivers',
    displayName: 'Natural Earth Rivers',
    description: 'Major river systems worldwide',
    license: 'Public Domain',
    licenseUrl: 'https://www.naturalearthdata.com/about/terms-of-use/',
    attribution: 'Made with Natural Earth',
    website: 'https://www.naturalearthdata.com/',
    maxAdminLevel: 0,
    category: 'route',
    licenseType: 'public',
  },
] as const;

export default ROUTE_DATA_SOURCES;
