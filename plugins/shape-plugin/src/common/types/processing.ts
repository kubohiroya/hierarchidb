import type { DataSourceName } from './data-source.js';
import type { HybridFilterConfig } from './BatchConfig.js';

export type FeatureFilterMethod = 'bbox_only' | 'polygon_only' | 'hybrid' | 'none';

export interface BatchConfig {
  dataSource?: DataSourceName;
  downloadConfig?: DownloadBatchConfig;
  extract1Config?: Extract1Config;
  extract2Config?: Extract2Config;
  extractionConfig?: ExtractionBatchConfig;
  tileConfig?: TileBatchConfig;
  cleanupConfig?: CleanupBatchConfig;
  source?: string;
}

export interface DownloadBatchConfig {
  maxConcurrent: number;
  retryLimit?: number;
  retryBackoff?: 'linear' | 'exponential';
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface ExtractionBatchConfig {
  featureFilterMethod: FeatureFilterMethod;
  areaThreshold: number;
  minVertexCountForAreaFilter?: number;
  aspectRatioThreshold?: number;
  hybridFilterConfig?: HybridFilterConfig;
  level1Workers: number;
  level2Workers: number;
  tolerance: number;
  quantize?: number;
  enablePerFeatureExtraction?: boolean;
}

export interface Extract1Config {
  workers: number;
  tolerance: number;
  featureFilterMethod: FeatureFilterMethod;
  areaThreshold: number;
  minVertexCountForAreaFilter?: number;
  aspectRatioThreshold?: number;
  hybridFilterConfig?: HybridFilterConfig;
}

export type Extract2ExtractionMode = 'off' | 'topojson' | 'geojson';

export interface Extract2Config {
  workers: number;
  tolerance: number;
  quantize?: number;
  enablePerFeatureExtraction?: boolean;
  extractionMode?: Extract2ExtractionMode;
}

export interface TileBatchConfig {
  workers: number;
  minZoom: number;
  maxZoom: number;
  bufferSize?: number;
  tileSize?: number;
  zoomBreakpoints?: number[];
  tileExpandFactor?: number;
  tileExpandMargin?: number;
}

export interface CleanupBatchConfig {
  deleteDownloadedFiles?: boolean;
  deleteStage1Cache?: boolean;
  deleteStage2Cache?: boolean;
}
