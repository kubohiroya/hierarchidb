import type { DataSourceName as CoreDataSourceName } from '@hierarchidb/core-types';

export type CacheEntryData = Record<string, unknown> | string | number | boolean | null;

export type DataSourceName = CoreDataSourceName;

export interface CommonSessionConfig {
  dataSourceName?: DataSourceName;
}

export interface FetchConfig {
  maxConcurrent: number;
  deleteOnComplete: boolean;
  timeoutMs: number;
  retryAttempts: number;
  retryDelay: number;
  retryLimit: number;
  retryBackoff: 'linear' | 'exponential';
  geometryIntakeGuard?: FetchGeometryIntakeGuardConfig;
  invalidGeometryFilter?: FetchInvalidGeometryFilterConfig;
}

export type GeometryIntakeValidationLevel = 'off' | 'basic' | 'strict';

export type FetchGeometryIntakeGuardConfig = {
  validationLevel: GeometryIntakeValidationLevel;
  dedupeEpsilon: number;
  minRingAreaThreshold: number;
  normalizeRingOrientation: boolean;
  keepBaselineSnapshot: boolean;
};

export type FetchInvalidGeometryFilterConfig = {
  area: boolean;
  lineLength: boolean;
  maxEdgeLength: boolean;
  selfIntersection: boolean;
  triangleRingRatio: boolean;
};

export interface CleanupConfig {
  deleteFetchApiCache?: boolean;
  deleteFetchFilteredCache?: boolean;
  deleteTransformCache?: boolean;
  deleteVTCache?: boolean;
}

export type FeatureFilterMethod = 'bbox_only' | 'polygon_only' | 'hybrid' | 'none';

export type HybridFilterConfig = {
  quickRejectThreshold?: number;
  regularShapeMinRatio?: number;
  regularShapeMaxRatio?: number;
  simpleShapeVertexThreshold?: number;
  elongatedShapeCorrectionFactor?: number;
};

export type RingFixConfig = {
  minRingVertices: number;
  minRingAreaMultiplier: number;
  removeDuplicateConsecutivePoints: boolean;
  removeCollinearPoints: boolean;
};

export type SelfIntersectionStrategy = 'keep_largest' | 'keep_all' | 'keep_outer';

export type SelfIntersectionConfig = {
  strategy: SelfIntersectionStrategy;
  minPolygonAreaMultiplier: number;
  maxPolygons: number;
  retainHoles: boolean;
  snapToleranceMultiplier: number;
};

export type PreSimplifyFilterConfig = {
  excludeInvalidGeometry: boolean;
  dropInvalidHoles: boolean;
  splitSelfIntersections: boolean;
  dropSmallPolygons: boolean;
  maxVerticesPerFeature?: number;
};

export type ExtractionMode = 'off' | 'topojson' | 'geojson';

export type OmitDetailsLevel = 'weak' | 'medium' | 'strong';

export type OmitDetailsConfig = {
  level: OmitDetailsLevel;
};

export type SelfIntersectionTuningConfig = {
  disableAtZoomOrBelow: number;
  maxVerticesForFix: number;
  maxVerticesForSplit: number;
};

export type GeometryEngine = 'turf';
export type TransformSimplifyAlgorithm = 'geojson' | 'topojson';
export type TransformExecutionLogLevel = 'off' | 'summary' | 'verbose';
export type VTOutputQualityGuardAction =
  | 'mark_warning'
  | 'fallback_less_simplified'
  | 'drop_tile'
  | 'skip_task';

export type VTOutputQualityGuardConfig = {
  enabled: boolean;
  minZoom: number;
  maxZoom: number;
  actionOnAnomaly: VTOutputQualityGuardAction;
  enablePreviewOverlay?: boolean;
  scoreThreshold: number;
  minTriangleAngleDeg: number;
  minEdgeToBaseRatio: number;
  maxAreaToBBoxRatio: number;
  minSpanRatio: number;
  minBoundaryVertexCount: number;
};

export interface TransformConfig {
  zoomBandBoundaries: number[];
  maxConcurrent: number;
  geometryEngine?: GeometryEngine;
  simplifyAlgorithm?: TransformSimplifyAlgorithm;
  preserveTopology?: boolean;
  executionLogLevel?: TransformExecutionLogLevel;
  enableFeatureFiltering: boolean;
  featureAreaThreshold: number;
  minVertexCountForAreaFilter: number;
  aspectRatioThreshold: number;
  featureFilterMethod: FeatureFilterMethod;
  hybridFilterConfig: HybridFilterConfig;
  deleteOnComplete: boolean;
  toleranceByBand: number[];
  retryCount?: number;
  retryToleranceByBand?: number[];
  retryToleranceStep?: number;
  quantize?: number;
  areaThreshold: number;
  excludePolygonAreaCoefficient: number;
  omitDetailsConfig: OmitDetailsConfig;
  minRingVertices: number;
  boundaryDisableAtZoomOrAbove?: number;
}

export type DynamicConcurrencyConfig = {
  enabled: boolean;
  minConcurrent: number;
  maxConcurrent?: number;
  highWatermark: number;
  lowWatermark: number;
  adjustStep: number;
  sampleMs: number;
};

export interface VTConfig {
  enableTopojsonSimplify: boolean;
  maxConcurrent: number;
  dynamicConcurrency?: DynamicConcurrencyConfig;
  tolerance: number;
  extent: number;
  bufferSize: number;
  boundaryDedupe: boolean;
  indexMaxPoints: number;
  layerSetName: string;
  promoteId: string;
  tileSize: number;
  inputFormat: 'geojson' | 'flatgeobuf';
  inputCompression: 'gzip' | 'none';
  tileExpandFactor: number;
  tileExpandMargin: number;
  format: 'mvt' | 'pbf';
  compression: 'gzip' | 'bz';
  outputQualityGuard?: VTOutputQualityGuardConfig;
  debug?: {
    enabled?: boolean;
    tiles?: readonly string[];
    features?: readonly string[];
  };
}

export interface RouteTransformConfig {
  minDistanceMetersByBand?: number[];
  simplifyToleranceByBand?: number[];
}

export interface BaseBuildConfig<TDataSourceName = unknown> {
  dataSourceName?: TDataSourceName;
  fetchConfig: FetchConfig;
  transformConfig: TransformConfig;
  vtConfig: VTConfig;
  cleanupConfig?: CleanupConfig;
  routeTransformConfig?: RouteTransformConfig;
}
