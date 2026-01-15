import type { DataSourceName } from './datasource.js';

export interface CommonSessionConfig {
  dataSourceName?: DataSourceName;
}

export interface FetchConfig {
  concurrentDownloads: number;
  concurrentDownload?: number;
  deleteOnComplete?: boolean;
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelay?: number;
  retryLimit?: number;
  retryBackoff?: 'linear' | 'exponential';
}

export interface CleanupConfig {
  deleteFetchCeche?: boolean;
  deleteTransformByBandCache?: boolean;
  deleteTransformByZoomCache?: boolean;
}
