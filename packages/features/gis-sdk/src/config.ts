import type {
  CommonSessionConfig as CommonCommonSessionConfig,
  DataSourceName as CommonDataSourceName,
  FetchConfig as CommonFetchConfig,
  CleanupConfig as CommonCleanupConfig,
} from '@hierarchidb/common-types';

export type CacheEntryData = Record<string, unknown> | string | number | boolean | null;

export type DataSourceName = CommonDataSourceName;
export type CommonSessionConfig = CommonCommonSessionConfig;
export type FetchConfig = CommonFetchConfig;
export type CleanupConfig = CommonCleanupConfig;

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
  concurrentProcesses?: number;
  enableFeatureFiltering?: boolean;
  featureAreaThreshold?: number;
  minVertexCountForAreaFilter?: number;
  aspectRatioThreshold?: number;
  featureFilterMethod?: FeatureFilterMethod;
  hybridFilterConfig?: HybridFilterConfig;
  deleteOnComplete?: boolean;
  tolerance?: number;
  areaThreshold?: number;
}

export interface TransformByZoomConfig {
  concurrentProcesses?: number;
  quantize?: number;
  extract?: number;
  tolerance?: number;
  enablePerFeatureExtraction?: boolean;
  extractionMode?: ExtractionMode;
  deleteOnComplete?: boolean;
}

export interface VTConfig {
  concurrentProcesses?: number;
  tolerance?: number;
  extent?: number;
  bufferSize?: number;
  boundaryDedupe?: boolean;
  indexMaxPoints?: number;
  layerSetName?: string;
  promoteId?: string;
  tileSize?: number;
  inputFormat?: 'geojson' | 'flatgeobuf';
  inputCompression?: 'gzip' | 'none';
  tileExpandFactor?: number;
  tileExpandMargin?: number;
  format?: 'mvt' | 'pbf';
  compression?: 'gzip' | 'bz';
  workers?: number;
}

export interface BaseBuildConfig<TDataSourceName = unknown> {
  dataSourceName?: TDataSourceName;
  fetchConfig: FetchConfig;
  transformByBandConfig: TransformByBandConfig;
  transformByZoomConfig: TransformByZoomConfig;
  vtConfig: VTConfig;
  cleanupConfig?: CleanupConfig;
}
