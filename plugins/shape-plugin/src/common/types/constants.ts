/**
 * Shape plugin constants
 */

import type { DataSourceConfig } from './data-source.js';

import { DEFAULT_BUILD_CONFIG, DEFAULT_PROCESSING_CONFIG } from '@hierarchidb/shape-api';

export { DEFAULT_BUILD_CONFIG, DEFAULT_PROCESSING_CONFIG };

export const SHAPE_DATA_SOURCES = [
  {
    name: 'naturalearth' as DataSourceConfig['name'],
    displayName: 'Natural Earth',
    description: 'Free vector and raster map data at 1:10m, 1:50m, and 1:110m scales',
    license: 'Public Domain',
    licenseUrl: 'https://www.naturalearthdata.com/about/terms-of-use/',
    attribution: 'Made with Natural Earth',
    color: '#2E8B57',
    icon: '🌍',
    maxAdminLevel: 2,
    //countryCodeFormat: 'iso2',
  },
  {
    name: 'geoboundaries' as DataSourceConfig['name'],
    displayName: 'geoBoundaries',
    description: 'Open administrative boundaries for all countries',
    license: 'CC BY 4.0',
    licenseUrl: 'https://geoboundaries.org/globalLicense.html',
    attribution: 'geoBoundaries Global Database',
    color: '#4169E1',
    icon: '🗺️',
    maxAdminLevel: 5,
    countryCodeFormat: 'iso3',
  },
  {
    name: 'geoboundaries-topojson' as DataSourceConfig['name'],
    displayName: 'geoBoundaries:TopoJSON',
    description: 'geoBoundaries with TopoJSON caching and merged ADM0 polygons',
    license: 'CC BY 4.0',
    licenseUrl: 'https://geoboundaries.org/globalLicense.html',
    attribution: 'geoBoundaries Global Database',
    color: '#3458D4',
    icon: '🧭',
    maxAdminLevel: 5,
    countryCodeFormat: 'iso3',
  },
  {
    name: 'gadm' as DataSourceConfig['name'],
    displayName: 'GADM',
    description: 'Global Administrative Areas database',
    license: 'Custom (Academic Use)',
    licenseUrl: 'https://gadm.org/license.html',
    attribution: 'GADM.org',
    color: '#FF6347',
    icon: '🌐',
    maxAdminLevel: 4,
    countryCodeFormat: 'iso3',
  },
] as DataSourceConfig[];

export const SHAPE_DATA_SOURCE_BY_NAME = Object.fromEntries(
  SHAPE_DATA_SOURCES.map((source) => [source.name, source]),
) as Record<DataSourceConfig['name'], DataSourceConfig>;
