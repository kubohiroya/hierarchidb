/**
 * Types specific to build processing sessions
 */

import type { BuildSessionConfig } from '@hierarchidb/shape-store';

/**
 * Extended build process configuration that includes worker settings
 */
export interface BuildProcessConfig extends BuildSessionConfig {
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

  // Extraction settings (if not already in ObsolateBuildConfig)
  extractTolerance?: number;
  minArea?: number;
  tileSize?: number;
}
