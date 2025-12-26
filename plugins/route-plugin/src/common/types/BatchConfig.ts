type BaseBatchConfigShape = {
  maxRetries?: number;
  retryDelay?: number;
  workerTimeout?: number;
  maxMemoryPerWorker?: number;
  enableProgressTracking?: boolean;
  enableResourceMonitoring?: boolean;
};

export interface RouteBatchConfig extends BaseBatchConfigShape {
  routeGeneration: {
    method: 'direct' | 'osm_route' | 'great_circle' | 'searoute';
    parallel: boolean;
    maxConcurrent: number;
    retryOnFailure: boolean;
    maxRetries: number;
  };
  locationResolution?: { batchSize: number; cacheResults: boolean; fallbackToCoordinates: boolean };
  validation?: {
    checkLocationExists: boolean;
    checkDuplicateRoutes: boolean;
    validateDistance: boolean;
    maxDistanceKm?: number
  };
  /** Optional per-lane concurrency caps override (e.g. { osm_route: 1, searoute: 4 }) */
  laneCaps?: Partial<Record<'osm_route' | 'searoute' | 'direct' | 'great_circle' | 'custom', number>>;
}

// Aligned alias for cross-plugin naming consistency.
export type BatchConfig = RouteBatchConfig;
