/**
  * @file ObsolateBuildConfig.ts
 * @description ERIA-Cartograph:
 */

//import { FeatureFilterMethod, FeatureFilterMethod } from '@hierarchidb/core-types';
import type {
  ExtractionMode as CommonExtractionMode,
  FeatureFilterMethod as CommonFeatureFilterMethod,
  FetchConfig as CommonFetchConfig,
  HybridFilterConfig as CommonHybridFilterConfig,
  TransformConfig as CommonTransformConfig,
  VTConfig as CommonVTConfig,
} from '@hierarchidb/gis-sdk';
import type { DataSourceName } from './data-source.js';
//import type { ExtractionMode, FeatureFilterMethod } from './_BuildConfig.ts';

/**
 * Configuration for hybrid features filtering algorithm
 */

/**
 * Common configuration shared across all sessions
 */
export interface CommonSessionConfig {
  dataSource?: DataSourceName;
}

/**
 * Configuration specific to DownloadSession
 */
export type ShapeFetchConfig = CommonFetchConfig;
export type FeatureFilterMethod = CommonFeatureFilterMethod;
export type HybridFilterConfig = CommonHybridFilterConfig;
export type ExtractionMode = CommonExtractionMode;

/**
 * Configuration specific to ExtractSession1 (Feature Processing)
 */
export type TransformConfig = CommonTransformConfig;

/**
 * Configuration specific to GenerateVectorTilesSession
 */
export type VTConfig = CommonVTConfig;

/**
 * Complete batch processing configuration
 * Combines all session-specific configurations
 */
export interface ObsolateBuildConfig extends CommonSessionConfig {
  // Session-specific configurations
  fetchConfig: ShapeFetchConfig;
  transformConfig: TransformConfig;
  vtConfig: VTConfig;

  deleteDownloadCacheOnComplete?: boolean;
  deleteExtract1CacheOnComplete?: boolean;
  deleteExtract2CacheOnComplete?: boolean;
}
