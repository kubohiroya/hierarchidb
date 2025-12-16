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
}

export interface SimplificationProcessingConfig {
  enableFiltering: boolean;
  featureFilterMethod: FeatureFilterMethod;
  areaThreshold: number;
  level1Workers: number;
  level2Workers: number;
  tolerance: number;
}

export interface TileProcessingConfig {
  workers: number;
  maxZoom: number;
  bufferSize?: number;
}

export interface CleanupProcessingConfig {
  deleteDownloadedFiles?: boolean;
}
