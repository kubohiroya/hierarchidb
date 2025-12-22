/**
 * Types specific to batch processing sessions
 */

import type { BatchSessionConfig } from '../../common/types/BatchConfig.js';

/**
 * Extended batch process configuration that includes worker settings
 */
export interface BatchProcessConfig extends BatchSessionConfig {
  // Worker configuration
  downloadWorkers?: number;
  simplify1Workers?: number;
  simplify2Workers?: number;
  vectorTileWorkers?: number;

  // Worker options
  workerTimeout?: number;
  workerRetries?: number;
  retryDelay?: number;
  maxMemoryPerWorker?: number;

  // Simplification settings (if not already in BatchConfig)
  simplifyTolerance?: number;
  minArea?: number;
  minZoom?: number;
  maxZoom?: number;
  tileSize?: number;
}
