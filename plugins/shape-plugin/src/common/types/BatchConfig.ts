/**
  * @file BatchConfig.ts
 * @description ERIA-Cartograph:
 */

import type { DataSourceName } from './data-source.js';
import type { FeatureFilterMethod } from './processing.js';

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
  simpleShapeVertexThreshold: number; // Max vertices to consider shape-plugin as simple (default: 50)

  // Step 4: Elongated simple shape-plugin correction
  elongatedShapeCorrectionFactor: number; // Correction factor for elongated simple shapes (default: 0.8)

  // Step 5 is always applied for remaining features
}

/**
 * Common configuration shared across all sessions
 */
export interface CommonSessionConfig {
  corsProxyBaseURL: string;
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
 * Configuration specific to SimplifySession1 (Feature Processing)
 */
export interface SimplifySession1Config {
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
 * Configuration specific to SimplifySession2 (Tile Processing)
 */
export interface SimplifySession2Config {
  concurrentProcesses: number;

  // Simplification parameters
  quantize: number;
  simplify: number;
  tolerance: number;
  enablePerFeatureSimplification: boolean;

  deleteOnComplete?: boolean; // Delete TileBuffer after session completes
}

/**
 * Configuration specific to GenerateVectorTilesSession
 */
export interface GenerateVectorTilesConfig {
  concurrentProcesses: number;
  minZoom: number;
  maxZoom: number;
  bufferSize?: number;
  tileSize?: number;
}

/**
 * Complete batch processing configuration
 * Combines all session-specific configurations
 */
export interface BatchSessionConfig extends CommonSessionConfig {
  // Session-specific configurations
  download: DownloadSessionConfig;
  simplify1: SimplifySession1Config;
  simplify2: SimplifySession2Config;
  vectorTiles: GenerateVectorTilesConfig;

  // Legacy flat structure for backward compatibility
  // TODO: Remove these after migrating all usages to nested structure
  concurrentDownloads?: number;
  concurrentProcesses?: number;
  quantize?: number;
  simplify?: number;
  tolerance?: number;
  maxZoom?: number;
  minZoom?: number;
  featureAreaThreshold?: number;
  minVertexCountForAreaFilter?: number;
  enableFeatureFiltering?: boolean;
  enablePerFeatureSimplification?: boolean;
  aspectRatioThreshold?: number;
  featureFilterMethod?: FeatureFilterMethod;
  hybridFilterConfig?: HybridFilterConfig;
  deleteDownloadCacheOnComplete?: boolean;
  deleteSimplify1CacheOnComplete?: boolean;
  deleteSimplify2CacheOnComplete?: boolean;
}
