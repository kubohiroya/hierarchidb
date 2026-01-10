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
  extract1Workers?: number;
  extract2Workers?: number;
  vectorTileWorkers?: number;

  // Worker options
  workerTimeout?: number;
  workerRetries?: number;
  retryDelay?: number;
  maxMemoryPerWorker?: number;

  // Extraction settings (if not already in BatchConfig)
  extractTolerance?: number;
  minArea?: number;
  tileSize?: number;
}
