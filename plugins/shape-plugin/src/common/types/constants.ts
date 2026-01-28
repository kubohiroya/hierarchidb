/**
 * Shape plugin constants
 */

import type { DataSourceConfig } from './data-source.js';

import type { ShapeBuildConfig } from './build.js';
import { DEFAULT_ZOOM_BAND_BOUNDARIES } from '@hierarchidb/util';

export const DEFAULT_BUILD_CONFIG: ShapeBuildConfig = {
  dataSourceName: 'geoboundaries',
  fetchConfig: {
    maxConcurrent: 2,
    deleteOnComplete: false,
    timeoutMs: 300000,
    retryAttempts: 3,
    retryDelay: 1000,
    retryLimit: 3,
    retryBackoff: 'linear',
  },
  transformConfig: {
    zoomBandBoundaries: DEFAULT_ZOOM_BAND_BOUNDARIES,
    maxConcurrent: 2,
    enableFeatureFiltering: true,
    featureAreaThreshold: 1.0,
    minVertexCountForAreaFilter: 10,
    aspectRatioThreshold: 5,
    featureFilterMethod: 'hybrid',
    hybridFilterConfig: {
      quickRejectThreshold: 0.002,
      regularShapeMinRatio: 0.5,
      regularShapeMaxRatio: 2.0,
      simpleShapeVertexThreshold: 10,
      elongatedShapeCorrectionFactor: 1.3,
    },
    deleteOnComplete: false,
    tolerance: 0.1,
    areaThreshold: 1.0,
    excludePolygonAreaCoefficient: 1,
    omitDetailsConfig: {
      level: 'strong',
    },
    areaBasedTolerance: {
      thresholdAreaPx2: 4096 * 4096,
      largeAreaTolerance: 0.1,
    },
    minRingVertices: 4,
    boundaryDisableAtZoomOrAbove: 3,
  },
  vtConfig: {
    enableTopojsonSimplify: true,
    maxConcurrent: 1,
    dynamicConcurrency: {
      enabled: true,
      minConcurrent: 1,
      highWatermark: 0.85,
      lowWatermark: 0.6,
      adjustStep: 1,
      sampleMs: 2000,
    },
    tolerance: 0,
    extent: 4096,
    bufferSize: 256,
    boundaryDedupe: true,
    indexMaxPoints: 0,
    layerSetName: 'shape',
    promoteId: 'id',
    tileSize: 256,
    inputFormat: 'geojson',
    inputCompression: 'none',
    tileExpandFactor: 1,
    tileExpandMargin: 0,
    format: 'mvt',
    compression: 'gzip',
  },
  cleanupConfig: {
    deleteFetchApiCache: false,
    deleteFetchFilteredCache: false,
    deleteTransformCache: false,
    deleteVTCache: false,
  },
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
