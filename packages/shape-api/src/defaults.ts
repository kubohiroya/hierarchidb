import { DEFAULT_ZOOM_BAND_BOUNDARIES } from '@hierarchidb/util';

export const DEFAULT_BUILD_CONFIG = {
  dataSourceName: 'geoboundaries',
  fetchConfig: {
    deleteOnComplete: false,
    timeoutMs: 300000,
  },
  transformConfig: {
    zoomBandBoundaries: DEFAULT_ZOOM_BAND_BOUNDARIES,
    geometryEngine: 'turf',
    simplifyAlgorithm: 'topojson',
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
    tolerance: 0.2,
    areaThreshold: 1.0,
    excludePolygonAreaCoefficient: 1,
    omitDetailsConfig: {
      level: 'strong',
    },
    minRingVertices: 4,
    boundaryDisableAtZoomOrAbove: 3,
  },
  vtConfig: {
    enableTopojsonSimplify: true,
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
    debug: {
      enabled: false,
      tiles: [],
      features: [],
    },
  },
  cleanupConfig: {
    deleteFetchApiCache: false,
    deleteFetchFilteredCache: false,
    deleteTransformCache: false,
    deleteVTCache: false,
  },
} as const;

export const DEFAULT_PROCESSING_CONFIG = {
  fetch: {
    maxConcurrent: 4,
    retryAttempts: 6,
    retryDelay: 5000,
    retryLimit: 6,
    retryBackoff: 'linear',
  },
  transform: {
    maxConcurrent: 3,
  },
  vt: {
    maxConcurrent: 1,
    dynamicConcurrency: {
      enabled: true,
      minConcurrent: 1,
      highWatermark: 0.85,
      lowWatermark: 0.6,
      adjustStep: 1,
      sampleMs: 2000,
    },
  },
} as const;
