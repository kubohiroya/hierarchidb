/**
 * Shape plugin constants
 */

import type { DataSourceConfig } from './data-source.js';

import type { ShapeBuildConfig } from './build.js';

export const DEFAULT_BUILD_CONFIG: ShapeBuildConfig = {
  dataSourceName: 'geoboundaries',
  fetchConfig: {
    concurrentDownloads: 2,
    timeoutMs: 300000,
    retryAttempts: 3,
    retryDelay: 1000,
    deleteOnComplete: false,
  },
  transformByBandConfig: {
    concurrentProcesses: 2,
    enableFeatureFiltering: true,
    featureAreaThreshold: 1.0,
    featureFilterMethod: 'hybrid',
    minVertexCountForAreaFilter: 10,
    aspectRatioThreshold: 5,
    hybridFilterConfig: {
      quickRejectThreshold: 0.002,
      regularShapeMinRatio: 0.5,
      regularShapeMaxRatio: 2.0,
      simpleShapeVertexThreshold: 10,
      elongatedShapeCorrectionFactor: 1.3,
    },
    tolerance: 1.0,
  },
  transformByZoomConfig: {
    concurrentProcesses: 2,
    quantize: 1,
    tolerance: 1.0,
    enablePerFeatureExtraction: true,
    extract: 0,
  },
  vtConfig: {
    concurrentProcesses: 4,
    bufferSize: 256,
    boundaryDedupe: false,
    tolerance: 1,
    extent: 0,
    indexMaxPoints: 0,
    layerSetName: 'shape',
    promoteId: 'id',
  }

} as const;

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
    licenseUrl: 'https://www.geoboundaries.org/globalLicense.html',
    attribution: 'geoBoundaries Global Database',
    color: '#4169E1',
    icon: '🗺️',
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
  {
    name: 'openstreetmap' as DataSourceConfig['name'],
    displayName: 'OpenStreetMap',
    description: 'Community-driven geographic data',
    license: 'ODbL',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/',
    attribution: '© OpenStreetMap contributors',
    color: '#7EDD00',
    icon: '🛣️',
    maxAdminLevel: 3,
    countryCodeFormat: 'iso2',
  },
] as DataSourceConfig[];
