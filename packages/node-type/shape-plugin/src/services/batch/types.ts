/**
 * Types specific to batch processing sessions
 */

import type { BatchConfig } from '../../types/BatchConfig';

/**
 * Extended batch process configuration that includes worker settings
 */
export interface BatchProcessConfig extends BatchConfig {
  // Worker configuration
  downloadWorkers?: number;
  simplify1Workers?: number;
  simplify2Workers?: number;
  vectorTileWorkers?: number;
  
  // Worker options
  workerTimeout?: number;
  workerRetries?: number;
  maxMemoryPerWorker?: number;
  
  // Simplification settings (if not already in BatchConfig)
  simplifyTolerance?: number;
  minArea?: number;
  zoomLevels?: number[];
  tileSize?: number;
}