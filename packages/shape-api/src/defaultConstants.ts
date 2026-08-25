import { DEFAULT_ZOOM_BAND_BOUNDARIES } from '@hierarchidb/util';

const DEFAULT_TRANSFORM_TOLERANCE_BY_BAND = [0.1, 0.1, 0.1, 0.1];
const DEFAULT_RETRY_TOLERANCE_BY_BAND = [3.5, 2.5, 1.5, 1];
const DEFAULT_SIMPLIFY_RETRY_COUNT = 4;
const DEFAULT_TOLERANCE_MULTIPLIER_BY_BAND = [1, 1, 1, 1];
const DEFAULT_TOLERANCE_MIN_RATIO_BY_BAND = [0, 0, 0, 0];

export const DEFAULT_MAX_RATIO_VALUE = 3;

const DEFAULT_TOLERANCE_MAX_RATIO_BY_BAND = [
  DEFAULT_MAX_RATIO_VALUE,
  DEFAULT_MAX_RATIO_VALUE,
  DEFAULT_MAX_RATIO_VALUE,
  DEFAULT_MAX_RATIO_VALUE,
];
const DEFAULT_TOLERANCE_SEARCH_MAX_ITERATIONS = 24;

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
    toleranceMultiplierByBand: DEFAULT_TOLERANCE_MULTIPLIER_BY_BAND,
    toleranceMinRatioByBand: DEFAULT_TOLERANCE_MIN_RATIO_BY_BAND,
    toleranceMaxRatioByBand: DEFAULT_TOLERANCE_MAX_RATIO_BY_BAND,
    toleranceSearchMaxIterations: DEFAULT_TOLERANCE_SEARCH_MAX_ITERATIONS,
    simplifyToleranceByAdminLevel: {
      admin0: {
        usePrevious: false,
        multiplierByBand: DEFAULT_TOLERANCE_MULTIPLIER_BY_BAND,
        minRatioByBand: DEFAULT_TOLERANCE_MIN_RATIO_BY_BAND,
        maxRatioByBand: DEFAULT_TOLERANCE_MAX_RATIO_BY_BAND,
        toleranceSearchMaxIterations: DEFAULT_TOLERANCE_SEARCH_MAX_ITERATIONS,
      },
      admin1: {
        usePrevious: true,
        multiplierByBand: DEFAULT_TOLERANCE_MULTIPLIER_BY_BAND,
        minRatioByBand: DEFAULT_TOLERANCE_MIN_RATIO_BY_BAND,
        maxRatioByBand: DEFAULT_TOLERANCE_MAX_RATIO_BY_BAND,
        toleranceSearchMaxIterations: DEFAULT_TOLERANCE_SEARCH_MAX_ITERATIONS,
      },
      admin2: {
        usePrevious: true,
        multiplierByBand: DEFAULT_TOLERANCE_MULTIPLIER_BY_BAND,
        minRatioByBand: DEFAULT_TOLERANCE_MIN_RATIO_BY_BAND,
        maxRatioByBand: DEFAULT_TOLERANCE_MAX_RATIO_BY_BAND,
        toleranceSearchMaxIterations: DEFAULT_TOLERANCE_SEARCH_MAX_ITERATIONS,
      },
      admin3Plus: {
        usePrevious: true,
        multiplierByBand: DEFAULT_TOLERANCE_MULTIPLIER_BY_BAND,
        minRatioByBand: DEFAULT_TOLERANCE_MIN_RATIO_BY_BAND,
        maxRatioByBand: DEFAULT_TOLERANCE_MAX_RATIO_BY_BAND,
        toleranceSearchMaxIterations: DEFAULT_TOLERANCE_SEARCH_MAX_ITERATIONS,
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
    invalidGeometryFilter: {
      area: false,
      lineLength: false,
      maxEdgeLength: false,
      selfIntersection: false,
      triangleRingRatio: false,
    },
    enableTopojsonSimplify: false,
    tolerance: 0,
    extent: 8192,
    buffer: 128,
    bufferSize: 128,
    boundaryDedupe: true,
    indexMaxPoints: 100000,
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
  borderGeometryConfig: {
    enabled: false,
    simplifyTolerance: 0,
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
