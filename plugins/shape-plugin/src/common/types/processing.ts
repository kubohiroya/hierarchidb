import type { HybridFilterConfig } from './BatchConfig.js';

export type FeatureFilterMethod = 'bbox_only' | 'polygon_only' | 'hybrid';

export interface ProcessingConfig {
  dataSource?: string;
  downloadConfig?: DownloadProcessingConfig;
  simplificationConfig?: SimplificationProcessingConfig;
  tileConfig?: TileProcessingConfig;
  cleanupConfig?: CleanupProcessingConfig;
  source?: string;
}

export interface DownloadProcessingConfig {
  maxConcurrent: number;
  corsProxyUrl?: string;
  retryLimit?: number;
  retryBackoff?: 'linear' | 'exponential';
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface SimplificationProcessingConfig {
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

export interface TileProcessingConfig {
  workers: number;
  minZoom: number;
  maxZoom: number;
  bufferSize?: number;
}

export interface CleanupProcessingConfig {
  deleteDownloadedFiles?: boolean;
}
