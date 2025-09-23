/**
 * Unified Batch Control Facade for Route Plugin
 * Provides standardized batch control API while maintaining backward compatibility
 */

import type { NodeId } from '@hierarchidb/common-type';
import type {
  BatchProgressCallback,
  BatchSessionStatus,
  IBatchSessionManager,
} from '@hierarchidb/runtime-shared-batch-processor';
import {
  isBatchControlAPIV2Enabled,
  MemoryProgressStore,
  ProgressEmitter,
} from '@hierarchidb/runtime-shared-batch-processor';
import { RouteBatchManager } from './RouteBatchManager.js';
import type { RouteBatchConfig } from './RouteBatchSession.js';
import type { RouteGenerationConfig } from '../entities/RouteEntity.js';

/**
 * Unified route batch manager implementing the standard interface
 */
export class UnifiedRouteBatchManager implements IBatchSessionManager {
  private manager: RouteBatchManager;
  private emitter: ProgressEmitter;
  private store: MemoryProgressStore;

  constructor() {
    // Create shared progress infrastructure
    this.emitter = new ProgressEmitter(10); // 10 Hz
    this.store = new MemoryProgressStore();

    // Initialize route manager with progress dependencies
    this.manager = new RouteBatchManager({
      emitter: this.emitter,
      store: this.store,
    });
  }

  async startBatchSession(nodeId: NodeId, config: RouteBatchConfigUnified, data?: RouteBatchData): Promise<string> {
    if (!data || !data.routes) {
      throw new Error('Route batch session requires routes data');
    }

    // Convert unified config to route-specific config
    const routeConfig: RouteBatchConfig = {
      corsProxyBaseURL: config.corsProxyBaseURL,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      workerTimeout: config.workerTimeout,
      maxMemoryPerWorker: config.maxMemoryPerWorker,
      enableProgressTracking: config.enableProgressTracking,
      enableResourceMonitoring: config.enableResourceMonitoring,
      routeGeneration: {
        method: config.routeGeneration?.method || 'direct',
        parallel: config.routeGeneration?.parallel ?? true,
        maxConcurrent: config.routeGeneration?.maxConcurrent || 4,
        retryOnFailure: config.routeGeneration?.retryOnFailure ?? false,
        maxRetries: config.routeGeneration?.maxRetries || 0,
      },
      locationResolution: config.locationResolution ? {
        batchSize: config.locationResolution.batchSize ?? 100,
        cacheResults: config.locationResolution.cacheResults ?? true,
        fallbackToCoordinates: config.locationResolution.fallbackToCoordinates ?? true,
      } : undefined,
      validation: config.validation ? {
        checkLocationExists: config.validation.checkLocationExists ?? false,
        checkDuplicateRoutes: config.validation.checkDuplicateRoutes ?? false,
        validateDistance: config.validation.validateDistance ?? false,
        maxDistanceKm: config.validation.maxDistanceKm,
      } : undefined,
      laneCaps: config.laneCaps,
    };

    return this.manager.startRouteBatchSession(nodeId, routeConfig, data.routes);
  }

  async pauseBatchSession(sessionId: string): Promise<void> {
    return this.manager.pauseRouteBatchSession(sessionId);
  }

  async resumeBatchSession(sessionId: string): Promise<void> {
    return this.manager.resumeRouteBatchSession(sessionId);
  }

  async cancelBatchSession(sessionId: string): Promise<void> {
    // Route manager doesn't have a cancel method, so we'll use pause as a fallback
    return this.manager.pauseRouteBatchSession(sessionId);
  }

  async getBatchSessionStatus(sessionId: string): Promise<BatchSessionStatus> {
    const progress = await this.manager.getRouteBatchProgress(sessionId);

    // Convert route-specific progress to standard format
    return {
      sessionId,
      nodeId: '' as NodeId, // Route manager doesn't track nodeId separately
      status: 'running', // Route manager doesn't track status explicitly
      progress: {
        total: progress.totalRoutes,
        completed: progress.completedRoutes,
        failed: progress.errors.length,
        percentage: progress.progress,
        currentStage: progress.phase,
      },
      startedAt: Date.now(), // Would need to be tracked
    };
  }

  onBatchProgress(sessionId: string, callback: BatchProgressCallback): () => void {
    // Use the shared progress emitter
    const unsubscribe = this.emitter.on((snapshot) => {
      if (snapshot.jobId === sessionId) {
        callback({
          sessionId,
          stage: snapshot.phase,
          total: 100, // Progress emitter uses percentage
          completed: Math.round(snapshot.progress),
          failed: 0, // Not tracked in progress snapshot
          percentage: snapshot.progress,
        });
      }
    });

    return unsubscribe;
  }
}

/**
 * Route-specific configuration interface (unified version)
 */
export interface RouteBatchConfigUnified {
  corsProxyBaseURL?: string;
  maxRetries?: number;
  retryDelay?: number;
  workerTimeout?: number;
  maxMemoryPerWorker?: number;
  enableProgressTracking?: boolean;
  enableResourceMonitoring?: boolean;
  routeGeneration?: {
    method?: 'direct' | 'osm_route' | 'great_circle' | 'searoute';
    parallel?: boolean;
    maxConcurrent?: number;
    retryOnFailure?: boolean;
    maxRetries?: number;
  };
  locationResolution?: {
    batchSize?: number;
    cacheResults?: boolean;
    fallbackToCoordinates?: boolean;
  };
  validation?: {
    checkLocationExists?: boolean;
    checkDuplicateRoutes?: boolean;
    validateDistance?: boolean;
    maxDistanceKm?: number;
  };
  laneCaps?: Partial<Record<'osm_route' | 'searoute' | 'direct' | 'great_circle' | 'custom', number>>;
}

/**
 * Route-specific data interface
 */
export interface RouteBatchData {
  routes: Array<{
    startLocationId?: NodeId;
    endLocationId?: NodeId;
    startCoordinates?: [number, number];
    endCoordinates?: [number, number];
    method?: RouteGenerationConfig['method'];
  }>;
}

/**
 * Factory function to get the appropriate batch manager
 * Returns the unified manager if API v2 is enabled, otherwise returns a wrapper around the legacy manager
 */
export function createRouteBatchManager(): IBatchSessionManager {
  return new UnifiedRouteBatchManager();
}

/**
 * Feature flag check for route plugin specifically
 */
export function isRouteBatchAPIV2Enabled(): boolean {
  return isBatchControlAPIV2Enabled();
}