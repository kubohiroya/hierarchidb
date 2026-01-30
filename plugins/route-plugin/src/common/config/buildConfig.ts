import type { BaseBuildConfig } from '@hierarchidb/gis-sdk';
import { DEFAULT_ZOOM_BAND_BOUNDARIES } from '@hierarchidb/util';

type RouteBuildConfig = BaseBuildConfig<string>;

type PartialRouteBuildConfig = Partial<RouteBuildConfig>;

export const DEFAULT_ROUTE_BUILD_CONFIG: RouteBuildConfig = {
  dataSourceName: 'ide-gsm',
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

export const mergeRouteBuildConfig = (
  base: RouteBuildConfig,
  overrides?: PartialRouteBuildConfig,
): RouteBuildConfig => {
  if (!overrides) return base;

  const fetchConfig = overrides.fetchConfig
    ? { ...base.fetchConfig, ...overrides.fetchConfig }
    : base.fetchConfig;

  const transformOverrides = overrides.transformConfig;
  const transformConfig = transformOverrides
    ? {
      ...base.transformConfig,
      ...transformOverrides,
      hybridFilterConfig: transformOverrides.hybridFilterConfig
        ? { ...base.transformConfig.hybridFilterConfig, ...transformOverrides.hybridFilterConfig }
        : base.transformConfig.hybridFilterConfig,
      areaBasedTolerance: transformOverrides.areaBasedTolerance
        ? { ...base.transformConfig.areaBasedTolerance, ...transformOverrides.areaBasedTolerance }
        : base.transformConfig.areaBasedTolerance,
    }
    : base.transformConfig;

  const vtConfig = overrides.vtConfig
    ? { ...base.vtConfig, ...overrides.vtConfig }
    : base.vtConfig;

  const cleanupConfig = overrides.cleanupConfig
    ? { ...(base.cleanupConfig ?? {}), ...overrides.cleanupConfig }
    : base.cleanupConfig;

  return {
    ...base,
    ...overrides,
    fetchConfig,
    transformConfig,
    vtConfig,
    cleanupConfig,
  };
};
