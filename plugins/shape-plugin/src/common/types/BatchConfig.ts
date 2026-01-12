/**
  * @file BatchConfig.ts
 * @description ERIA-Cartograph:
 */

import type { DataSourceName } from './data-source.js';
import type { Extract2ExtractionMode, FeatureFilterMethod } from './processing.js';

/**
 * Configuration for hybrid features filtering algorithm
 */
export interface HybridFilterConfig {
  // Step 1: Quick rejection threshold
  quickRejectThreshold: number; //  Features smaller than main threshold this value are immediately rejected (default: 0.1)

  // Step 2: Regular shape-plugin aspect ratio
  regularShapeMinRatio: number; // Min aspect ratio for regular shapes (default: 0.5)
  regularShapeMaxRatio: number; // Max aspect ratio for regular shapes (default: 2.0)

  // Step 3: Simple shape-plugin vertex threshold
  simpleShapeVertexThreshold: number; // Max vertices to consider shape-plugin as simple (default: 10)

  // Step 4: Elongated simple shape-plugin correction
  elongatedShapeCorrectionFactor: number; // Correction factor for elongated simple shapes (default: 0.8)

  // Step 5 is always applied for remaining features
}

/**
 * Common configuration shared across all sessions
 */
export interface CommonSessionConfig {
  dataSource?: DataSourceName;
}

/**
 * Configuration specific to DownloadSession
 */
export interface DownloadSessionConfig {
  concurrentDownloads: number;
  deleteOnComplete?: boolean; // Delete BatchBuffers after session completes
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * Configuration specific to ExtractSession1 (Feature Processing)
 */
export interface ExtractSession1Config {
  concurrentProcesses: number;

  // Feature filtering parameters
  enableFeatureFiltering: boolean;
  featureAreaThreshold: number; // Percentage threshold for filtering small features (0-100)
  minVertexCountForAreaFilter: number; // Minimum vertex count to apply area filtering
  aspectRatioThreshold: number; // Aspect ratio threshold for switching to polygon area calculation
  featureFilterMethod: FeatureFilterMethod; // Method for features filtering
  hybridFilterConfig?: HybridFilterConfig; // Hybrid filter specific configuration

  deleteOnComplete?: boolean; // Delete FeatureIndex/FeatureBuffer after session completes
}

/**
 * Configuration specific to ExtractSession2 (Tile Processing)
 */
export interface ExtractSession2Config {
  concurrentProcesses: number;

  // Extraction parameters
  quantize: number;
  extract: number;
  tolerance: number;
  enablePerFeatureExtraction: boolean;
  extractionMode?: Extract2ExtractionMode;

  deleteOnComplete?: boolean; // Delete TileBuffer after session completes
}

/**
 * Configuration specific to GenerateVectorTilesSession
 */
export interface GenerateVectorTilesConfig {
  concurrentProcesses: number;
  bufferSize?: number;
  tileSize?: number;
  inputFormat?: 'geojson' | 'flatgeobuf';
  inputCompression?: 'gzip' | 'none';
  tileExpandFactor?: number;
  tileExpandMargin?: number;
}

/**
 * Complete batch processing configuration
 * Combines all session-specific configurations
 */
export interface BuildSessionConfig extends CommonSessionConfig {
  // Session-specific configurations
  download: DownloadSessionConfig;
  extract1: ExtractSession1Config;
  extract2: ExtractSession2Config;
  vectorTiles: GenerateVectorTilesConfig;

  // Legacy flat structure for backward compatibility
  // TODO: Remove these after migrating all usages to nested structure
  concurrentDownloads?: number;
  concurrentProcesses?: number;
  quantize?: number;
  extract?: number;
  tolerance?: number;
  featureAreaThreshold?: number;
  minVertexCountForAreaFilter?: number;
  enableFeatureFiltering?: boolean;
  enablePerFeatureExtraction?: boolean;
  aspectRatioThreshold?: number;
  featureFilterMethod?: FeatureFilterMethod;
  hybridFilterConfig?: HybridFilterConfig;
  deleteDownloadCacheOnComplete?: boolean;
  deleteExtract1CacheOnComplete?: boolean;
  deleteExtract2CacheOnComplete?: boolean;
}

// Aligned alias for cross-plugin naming consistency.
export type BatchConfig = BuildSessionConfig;
