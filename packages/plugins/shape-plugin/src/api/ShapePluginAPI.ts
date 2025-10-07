/**
 * Shape Plugin API for HierarchiDB integration
 *
 * @deprecated Legacy main-thread API kept for reference only. The V2 runtime
 *             uses worker-based APIs (services/ShapesPluginAPI.ts and worker/api.ts).
 */

import type { NodeId } from '@hierarchidb/common-types';
import type {
  BatchProcessConfig,
  BatchSession,
  BatchStatus,
  BboxQueryOptions,
  BoundingBox,
  CacheStatistics,
  CacheType,
  CountryMetadata,
  DataSourceConfig,
  DataSourceInfo,
  Feature,
  OptimizationResult,
  SearchOptions,
  ShapesAPIMethods,
  TileMetadata,
  ValidationResult,
} from '../services/types';

import { ShapeService } from '../services/ShapeService';
// Note: These imports would be used in full implementation
// import { BatchSessionManager } from '~/services/batch/BatchSessionManager';
// import { DataSourceManager } from '~/services/datasource/DataSourceManager';
import { VectorTileService } from '../services/tiles/VectorTileService';
import { ShapeDB } from '../services/database/ShapeDB';

/**
 * Main Plugin API implementation that integrates with HierarchiDB Worker system
 */
/** @deprecated Use the worker-based ShapesPluginAPI (services/ShapesPluginAPI.ts). */
export class ShapePluginAPI implements ShapesAPIMethods {
  private shapeService: ShapeService;
  private workerPoolManager: any | null = null;
  // Note: These would be used in full implementation
  // private batchSessionManager: BatchSessionManager;
  // private dataSourceManager: DataSourceManager;
  private vectorTileService: VectorTileService;
  private database: ShapeDB;
  private isInitialized = false;

  constructor() {
    // Initialize database
    this.database = new ShapeDB();

    // Initialize services - would be implemented in full version
    // this.dataSourceManager = new DataSourceManager();
    this.vectorTileService = new VectorTileService();
    // this.batchSessionManager = new BatchSessionManager();

    // Deprecated WorkerPoolManager is not constructed here; lazy/flagged in initialize()

    // Initialize main service
    this.shapeService = new ShapeService();
  }

  /**
   * Initialize the plugin API and all services
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize database
      await this.database.open();

      // Legacy WorkerPool fallback removed; runtime-worker is required

      // Initialize services
      await this.shapeService.initialize();

      this.isInitialized = true;
      console.log('ShapePluginAPI initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ShapePluginAPI:', error);
      throw error;
    }
  }

  /**
   * Shutdown the plugin API and cleanup resources
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      // no-op: legacy worker pool removed
      await this.database.close();
      this.isInitialized = false;
      console.log('ShapePluginAPI shutdown complete');
    } catch (error) {
      console.error('Error during ShapePluginAPI shutdown:', error);
      throw error;
    }
  }

  // === Batch Processing API ===

  async startBatchProcess(nodeId: NodeId, config: BatchProcessConfig): Promise<BatchSession> {
    this.ensureInitialized();
    // Mock implementation for now
    return {
      sessionId: 'mock-session-' + Date.now(),
      nodeId,
      status: 'running',
      config,
      startedAt: Date.now(),
      updatedAt: Date.now(),
      progress: { total: 0, completed: 0, failed: 0, skipped: 0, percentage: 0 },
      stages: {
        download: { status: 'waiting', progress: 0, tasksTotal: 0, tasksCompleted: 0, tasksFailed: 0 },
        simplify1: { status: 'waiting', progress: 0, tasksTotal: 0, tasksCompleted: 0, tasksFailed: 0 },
        simplify2: { status: 'waiting', progress: 0, tasksTotal: 0, tasksCompleted: 0, tasksFailed: 0 },
        vectortile: { status: 'waiting', progress: 0, tasksTotal: 0, tasksCompleted: 0, tasksFailed: 0 },
      },
    };
  }

  async pauseBatchProcess(sessionId: string): Promise<void> {
    this.ensureInitialized();
    return this.shapeService.pauseBatchProcessing(sessionId);
  }

  async resumeBatchProcess(sessionId: string): Promise<void> {
    this.ensureInitialized();
    return this.shapeService.resumeBatchProcessing(sessionId);
  }

  async cancelBatchProcess(sessionId: string): Promise<void> {
    this.ensureInitialized();
    return this.shapeService.cancelBatchProcessing(sessionId);
  }

  async getBatchStatus(sessionId: string): Promise<BatchStatus> {
    this.ensureInitialized();
    return this.shapeService.getBatchStatus(sessionId);
  }

  // === Data Source API ===

  async getAvailableDataSources(): Promise<DataSourceInfo[]> {
    this.ensureInitialized();
    return this.shapeService.getAvailableDataSources();
  }

  async getCountryMetadata(dataSource: string, countryCode?: string): Promise<CountryMetadata[]> {
    this.ensureInitialized();
    return this.shapeService.getCountryMetadata(dataSource, countryCode || '');
  }

  async validateDataSource(dataSource: string, config: DataSourceConfig): Promise<ValidationResult> {
    this.ensureInitialized();
    return this.shapeService.validateDataSource(dataSource, config);
  }

  // === Vector Tile API ===

  async getTile(nodeId: NodeId, z: number, x: number, y: number): Promise<Uint8Array> {
    this.ensureInitialized();
    const tile = await this.vectorTileService.getTile({ nodeId, z, x, y });
    return tile || new Uint8Array();
  }

  async getTileMetadata(_nodeId: NodeId, _z: number, _x: number, _y: number): Promise<TileMetadata> {
    this.ensureInitialized();
    // Mock implementation for now
    return {
      exists: true,
      nodeId: _nodeId,
      tileKey: `${_z}-${_x}-${_y}`,
      z: _z,
      x: _x,
      y: _y,
      size: 0,
      layers: [],
      generatedAt: Date.now(),
      lastAccessed: Date.now(),
      features: 0,
      contentHash: 'mock-hash',
      version: 1,
    };
  }

  async clearTileCache(nodeId: NodeId): Promise<void> {
    this.ensureInitialized();
    return this.shapeService.clearTileCache(nodeId);
  }

  // === Feature Query API ===

  async searchFeatures(nodeId: NodeId, query: string, options?: SearchOptions): Promise<Feature[]> {
    this.ensureInitialized();
    return this.shapeService.searchFeatures(nodeId, query, options);
  }

  async getFeatureById(nodeId: NodeId, featureId: number): Promise<Feature | null> {
    this.ensureInitialized();
    return this.shapeService.getFeatureById(nodeId, featureId);
  }

  async getFeaturesByBbox(nodeId: NodeId, bbox: BoundingBox, options?: BboxQueryOptions): Promise<Feature[]> {
    this.ensureInitialized();
    return this.shapeService.getFeaturesByBbox(nodeId, bbox, options);
  }

  // === Cache Management API ===

  async getCacheStatistics(nodeId?: NodeId): Promise<CacheStatistics> {
    this.ensureInitialized();
    return this.shapeService.getCacheStatistics(nodeId);
  }

  async clearCache(nodeId: NodeId, cacheType?: CacheType): Promise<void> {
    this.ensureInitialized();
    return this.shapeService.clearCache(nodeId, cacheType);
  }

  async optimizeStorage(nodeId: NodeId): Promise<OptimizationResult> {
    this.ensureInitialized();
    return this.shapeService.optimizeStorage(nodeId);
  }

  // === Additional Plugin API Methods ===

  // (legacy worker pool statistics removed)

  /**
   * Get all active batch sessions
   */
  async getActiveBatchSessions(): Promise<BatchSession[]> {
    this.ensureInitialized();
    // Mock implementation - return empty array for now
    return [];
  }

  /**
   * Get health status of the plugin
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      database: boolean;
      workerPool: boolean;
      batchManager: boolean;
    };
    statistics: {
      activeSessions: number;
      queuedTasks: number;
      cachedTiles: number;
      storedFeatures: number;
    };
  }> {
    this.ensureInitialized();

    try {
      const [activeSessions, cacheStats] = await Promise.all([
        Promise.resolve([]),
        this.shapeService.getCacheStatistics(),
      ]);

      const totalQueuedTasks = 0;

      return {
        status: 'healthy',
        services: {
          database: this.database.isOpen(),
          workerPool: false,
          batchManager: true,
        },
        statistics: {
          activeSessions: activeSessions.length,
          queuedTasks: totalQueuedTasks,
          cachedTiles: cacheStats.byType?.tiles?.count ?? 0,
          storedFeatures: cacheStats.byType?.features?.count ?? 0,
        },
      };
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        services: {
          database: false,
          workerPool: false,
          batchManager: false,
        },
        statistics: {
          activeSessions: 0,
          queuedTasks: 0,
          cachedTiles: 0,
          storedFeatures: 0,
        },
      };
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('ShapePluginAPI not initialized. Call initialize() first.');
    }
  }
}

// Export singleton instance
/** @deprecated Legacy instance; avoid using in new code. */
export const shapePluginAPI = new ShapePluginAPI();
