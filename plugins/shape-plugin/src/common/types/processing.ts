import type { DataSourceName } from './data-source.js';
import type { HybridFilterConfig } from './BatchConfig.js';

export type FeatureFilterMethod = 'bbox_only' | 'polygon_only' | 'hybrid';

export interface BatchConfig {
  dataSource?: DataSourceName;
  downloadConfig?: DownloadBatchConfig;
  simplificationConfig?: SimplificationBatchConfig;
  tileConfig?: TileBatchConfig;
  cleanupConfig?: CleanupBatchConfig;
  source?: string;
}

export interface DownloadBatchConfig {
  maxConcurrent: number;
  corsProxyUrl?: string;
  retryLimit?: number;
  retryBackoff?: 'linear' | 'exponential';
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface SimplificationBatchConfig {
  featureFilterMethod: FeatureFilterMethod;
  areaThreshold: number;
  minVertexCountForAreaFilter?: number;
  aspectRatioThreshold?: number;
  hybridFilterConfig?: HybridFilterConfig;
  level1Workers: number;
  level2Workers: number;
  tolerance: number;
  quantize?: number;
  enablePerFeatureSimplification?: boolean;
}

export interface TileBatchConfig {
  workers: number;
  minZoom: number;
  maxZoom: number;
  bufferSize?: number;
  tileSize?: number;
}

export interface CleanupBatchConfig {
  deleteDownloadedFiles?: boolean;
}
