import type { RouteBuildConfig } from '@hierarchidb/route-api';
import { DEFAULT_ZOOM_BAND_BOUNDARIES } from '@hierarchidb/util';

type RouteBuildConfigLocal = RouteBuildConfig;

type PartialRouteBuildConfig = Partial<RouteBuildConfigLocal>;

export const DEFAULT_ROUTE_BUILD_CONFIG: RouteBuildConfig = {
  dataSourceName: 'ide-gsm',
  routeGeneration: {
    method: 'direct',
    parallel: true,
    maxConcurrent: 4,
    retryOnFailure: false,
    maxRetries: 0,
  },
  sourceConfig: {
    maxConcurrent: 2,
    deleteOnComplete: false,
    timeoutMs: 300000,
    retryAttempts: 3,
    retryDelay: 1000,
    retryLimit: 3,
    retryBackoff: 'linear',
  },
  geometryConfig: {
    zoomBandBoundaries: DEFAULT_ZOOM_BAND_BOUNDARIES,
    maxConcurrent: 2,
    geometryEngine: 'turf',
    simplifyAlgorithm: 'geojson',
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
    toleranceByBand: [0.1],
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
  },
  cleanupConfig: {
    deleteSourceApiCache: false,
    deleteSourceFilteredCache: false,
    deleteGeometryCache: false,
    deleteTileEmitCache: false,
  },
  routeGeometryConfig: {
    minDistanceMetersByBand: [0, 5_000, 10_000],
    simplifyToleranceByBand: [0.00005, 0.0001, 0.0002],
  },
} as const;

export const mergeRouteBuildConfig = (
  base: RouteBuildConfig,
  overrides?: PartialRouteBuildConfig
): RouteBuildConfig => {
  if (!overrides) return base;

  const sourceConfig = overrides.sourceConfig
    ? { ...base.sourceConfig, ...overrides.sourceConfig }
    : base.sourceConfig;

  const transformOverrides = overrides.geometryConfig;
  const geometryConfig = transformOverrides
    ? {
        ...base.geometryConfig,
        ...transformOverrides,
        hybridFilterConfig: transformOverrides.hybridFilterConfig
          ? { ...base.geometryConfig.hybridFilterConfig, ...transformOverrides.hybridFilterConfig }
          : base.geometryConfig.hybridFilterConfig,
      }
    : base.geometryConfig;

  const tileEmitConfig = overrides.tileEmitConfig
    ? { ...base.tileEmitConfig, ...overrides.tileEmitConfig }
    : base.tileEmitConfig;

  const cleanupConfig = overrides.cleanupConfig
    ? { ...(base.cleanupConfig ?? {}), ...overrides.cleanupConfig }
    : base.cleanupConfig;

  const routeGeometryConfig = overrides.routeGeometryConfig
    ? {
        ...base.routeGeometryConfig,
        ...overrides.routeGeometryConfig,
      }
    : base.routeGeometryConfig;

  const routeGeneration = overrides.routeGeneration
    ? { ...base.routeGeneration, ...overrides.routeGeneration }
    : base.routeGeneration;

  return {
    ...base,
    ...overrides,
    sourceConfig,
    geometryConfig,
    tileEmitConfig,
    routeGeneration,
    cleanupConfig,
    routeGeometryConfig,
  };
};
