import type { DataSourceName as CommonDataSourceName } from '@hierarchidb/common-types';

export type CacheEntryData = Record<string, unknown> | string | number | boolean | null;

export type DataSourceName = CommonDataSourceName;

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
}

export interface CleanupConfig {
  deleteFetchCeche?: boolean;
  deleteTransformByBandCache?: boolean;
  deleteTransformByZoomCache?: boolean;
}

export type FeatureFilterMethod = 'bbox_only' | 'polygon_only' | 'hybrid' | 'none';

export type HybridFilterConfig = {
  quickRejectThreshold?: number;
  regularShapeMinRatio?: number;
  regularShapeMaxRatio?: number;
  simpleShapeVertexThreshold?: number;
  elongatedShapeCorrectionFactor?: number;
};

export type ExtractionMode = 'off' | 'topojson' | 'geojson';

export interface TransformByBandConfig {
  maxConcurrent: number;
  enableFeatureFiltering: boolean;
  featureAreaThreshold: number;
  minVertexCountForAreaFilter: number;
  aspectRatioThreshold: number;
  featureFilterMethod: FeatureFilterMethod;
  hybridFilterConfig: HybridFilterConfig;
  deleteOnComplete: boolean;
  tolerance: number;
  areaThreshold: number;
}

export interface TransformByZoomConfig {
  maxConcurrent: number;
  quantize: number;
  extract: number;
  tolerance: number;
  enablePerFeatureExtraction: boolean;
  extractionMode: ExtractionMode;
  deleteOnComplete: boolean;
}

export interface VTConfig {
  maxConcurrent: number;
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
}

export interface BaseBuildConfig<TDataSourceName = unknown> {
  dataSourceName?: TDataSourceName;
  fetchConfig: FetchConfig;
  transformByBandConfig: TransformByBandConfig;
  transformByZoomConfig: TransformByZoomConfig;
  vtConfig: VTConfig;
  cleanupConfig?: CleanupConfig;
}
