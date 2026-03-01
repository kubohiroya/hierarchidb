import { DEFAULT_ZOOM_BAND_BOUNDARIES } from '@hierarchidb/util';

const DEFAULT_TRANSFORM_TOLERANCE_BY_BAND = [0.1, 0.1, 0.1, 0.1];
const DEFAULT_RETRY_TOLERANCE_BY_BAND = [3.5, 2.5, 1.5, 1];
const DEFAULT_SIMPLIFY_RETRY_COUNT = 4;

export const DEFAULT_BUILD_CONFIG = {
  dataSourceName: 'geoboundaries',
  sourceConfig: {
    deleteOnComplete: false,
    timeoutMs: 300000,
    geometryIntakeGuard: {
      validationLevel: 'off',
      dedupeEpsilon: 0.000001,
      minRingAreaThreshold: 0.0,
      normalizeRingOrientation: true,
      keepBaselineSnapshot: true,
    },
    invalidGeometryFilter: {
      area: false,
      lineLength: false,
      maxEdgeLength: false,
      selfIntersection: false,
      triangleRingRatio: false,
    },
  },
  geometryConfig: {
    zoomBandBoundaries: DEFAULT_ZOOM_BAND_BOUNDARIES,
    geometryEngine: 'turf',
    simplifyAlgorithm: 'topojson',
    preserveTopology: true,
    executionLogLevel: 'summary',
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
    toleranceByBand: DEFAULT_TRANSFORM_TOLERANCE_BY_BAND,
    retryCount: DEFAULT_SIMPLIFY_RETRY_COUNT,
    retryToleranceByBand: DEFAULT_RETRY_TOLERANCE_BY_BAND,
    simplifyToleranceByAdminLevel: {
      admin0: {
        usePrevious: false,
        toleranceByBand: DEFAULT_TRANSFORM_TOLERANCE_BY_BAND,
        retryToleranceByBand: DEFAULT_RETRY_TOLERANCE_BY_BAND,
        retryCount: DEFAULT_SIMPLIFY_RETRY_COUNT,
      },
      admin1: {
        usePrevious: true,
        toleranceByBand: DEFAULT_TRANSFORM_TOLERANCE_BY_BAND,
        retryToleranceByBand: DEFAULT_RETRY_TOLERANCE_BY_BAND,
        retryCount: DEFAULT_SIMPLIFY_RETRY_COUNT,
      },
      admin2: {
        usePrevious: true,
        toleranceByBand: DEFAULT_TRANSFORM_TOLERANCE_BY_BAND,
        retryToleranceByBand: DEFAULT_RETRY_TOLERANCE_BY_BAND,
        retryCount: DEFAULT_SIMPLIFY_RETRY_COUNT,
      },
      admin3Plus: {
        usePrevious: true,
        toleranceByBand: DEFAULT_TRANSFORM_TOLERANCE_BY_BAND,
        retryToleranceByBand: DEFAULT_RETRY_TOLERANCE_BY_BAND,
        retryCount: DEFAULT_SIMPLIFY_RETRY_COUNT,
      },
    },
    retryToleranceStep: 0.02,
    areaThreshold: 1.0,
    excludePolygonAreaCoefficient: 1,
    omitDetailsConfig: {
      level: 'strong',
    },
    minRingVertices: 4,
    boundaryDisableAtZoomOrAbove: 3,
  },
  tileEmitConfig: {
    enableTopojsonSimplify: false,
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
    deleteSourceApiCache: false,
    deleteSourceFilteredCache: false,
    deleteGeometryCache: false,
    deleteTileEmitCache: false,
  },
} as const;

export const DEFAULT_PROCESSING_CONFIG = {
  source: {
    maxConcurrent: 4,
    retryAttempts: 6,
    retryDelay: 5000,
    retryLimit: 6,
    retryBackoff: 'linear',
  },
  geometry: {
    maxConcurrent: 3,
  },
  tileEmit: {
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
