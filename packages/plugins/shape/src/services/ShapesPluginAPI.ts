/**
 * ShapesPluginAPI - Shape plugin API implementation
 * Extends HierarchiDB Worker with shape-specific methods via PluginAPI
 */

import { PluginAPI } from "@hierarchidb/01-api";
import { TreeNodeType, NodeId } from "@hierarchidb/00-core";
import type {
  ShapesAPIMethods,
  BatchProcessConfig,
  BatchSession,
  BatchStatus,
  DataSourceInfo,
  CountryMetadata,
  DataSourceConfig,
  ValidationResult,
  TileMetadata,
  Feature,
  SearchOptions,
  BboxQueryOptions,
  CacheStatistics,
  CacheType,
  OptimizationResult,
  BoundingBox,
  DataSourceName,
} from "./types";
import { WorkerPoolManager } from "./workers/WorkerPoolManager";
import { BatchSessionManager } from "./batch/BatchSessionManager";
import { DataSourceManager } from "./datasource/DataSourceManager";
import { VectorTileService } from "./tiles/VectorTileService";
import { UrlMetadata } from "~/types/index";

/**
 * Shape plugin API implementation
 * Provides Worker methods for shape data processing
 */
export class ShapesPluginAPI implements PluginAPI<ShapesAPIMethods> {
  readonly nodeType: TreeNodeType = "shape";
  readonly methods: ShapesAPIMethods;

  private workerPoolManager: WorkerPoolManager;
  private batchSessionManager: BatchSessionManager;
  private dataSourceManager: DataSourceManager;
  private vectorTileService: VectorTileService;

  constructor() {
    this.workerPoolManager = new WorkerPoolManager({
      downloadWorkers: 4,
      simplify1Workers: 2,
      simplify2Workers: 2,
      vectorTileWorkers: 2,
      workerOptions: {
        timeout: 10 * 1000,
        retries: 3,
        maxMemoryPerWorker: 32 * 1024 * 1024,
        restartThreshold: 32,
      },
    });
    this.batchSessionManager = new BatchSessionManager();
    this.dataSourceManager = new DataSourceManager();
    this.vectorTileService = new VectorTileService();

    // Define API methods
    this.methods = {
      // Batch processing methods
      startBatchProcess: this.startBatchProcess.bind(this),
      pauseBatchProcess: this.pauseBatchProcess.bind(this),
      resumeBatchProcess: this.resumeBatchProcess.bind(this),
      cancelBatchProcess: this.cancelBatchProcess.bind(this),
      getBatchStatus: this.getBatchStatus.bind(this),

      // Data source methods
      getAvailableDataSources: this.getAvailableDataSources.bind(this),
      getCountryMetadata: this.getCountryMetadata.bind(this),
      validateDataSource: this.validateDataSource.bind(this),

      // Vector tile methods
      getTile: this.getTile.bind(this),
      getTileMetadata: this.getTileMetadata.bind(this),
      clearTileCache: this.clearTileCache.bind(this),

      // Feature query methods
      searchFeatures: this.searchFeatures.bind(this),
      getFeatureById: this.getFeatureById.bind(this),
      getFeaturesByBbox: this.getFeaturesByBbox.bind(this),

      // Cache management
      getCacheStatistics: this.getCacheStatistics.bind(this),
      clearCache: this.clearCache.bind(this),
      optimizeStorage: this.optimizeStorage.bind(this),
    };
  }

  /**
   * Initialize the plugin API
   */
  async initialize(): Promise<void> {
    await this.workerPoolManager.initialize();
    await this.batchSessionManager.initialize();
    //await this.dataSourceManager.initialize();
    //await this.vectorTileService.initialize();
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    await this.workerPoolManager.shutdown();
    await this.batchSessionManager.shutdown();
    //await this.dataSourceManager.shutdown();
    //await this.vectorTileService.shutdown();
  }

  // === Batch Processing Methods ===

  async startBatchProcess(
    nodeId: NodeId,
    config: BatchProcessConfig,
    urlMetadata: UrlMetadata[],
  ): Promise<BatchSession> {
    return this.batchSessionManager.createSession(nodeId, config, urlMetadata);
  }

  async pauseBatchProcess(sessionId: string): Promise<void> {
    return this.batchSessionManager.pauseSession(sessionId);
  }

  async resumeBatchProcess(sessionId: string): Promise<void> {
    return this.batchSessionManager.resumeSession(sessionId);
  }

  async cancelBatchProcess(sessionId: string): Promise<void> {
    return this.batchSessionManager.cancelSession(sessionId);
  }

  async getBatchStatus(sessionId: string): Promise<BatchStatus> {
    return this.batchSessionManager.getSessionStatus(sessionId);
  }

  // === Data Source Methods ===

  async getAvailableDataSources(): Promise<DataSourceInfo[]> {
    return this.dataSourceManager.getAvailableDataSources();
  }

  async getCountryMetadata(
    dataSource: DataSourceName,
    countryCode?: string,
  ): Promise<CountryMetadata> {
    return this.dataSourceManager.getCountryMetadata(dataSource, countryCode);
  }

  async validateDataSource(
    dataSource: DataSourceName,
    config: DataSourceConfig,
  ): Promise<ValidationResult> {
    return this.dataSourceManager.validateDataSource(
      dataSource,
      config.countryCode,
      config.adminLevels.length, // FIXME, this may cause trouble
    );
  }

  // === Vector Tile Methods ===

  async getTile(
    nodeId: NodeId,
    z: number,
    x: number,
    y: number,
  ): Promise<Uint8Array> {
    return this.vectorTileService.getTile({ nodeId, z, x, y });
  }

  async getTileMetadata(
    nodeId: NodeId,
    z: number,
    x: number,
    y: number,
  ): Promise<TileMetadata> {
    return this.vectorTileService.getTileMetadata(nodeId, z, x, y);
  }

  async clearTileCache(nodeId: NodeId): Promise<number> {
    return this.vectorTileService.clearTileCache(nodeId);
  }

  // === Feature Query Methods ===

  async searchFeatures(
    _nodeId: NodeId,
    _query: string,
    _options?: SearchOptions,
  ): Promise<Feature[]> {
    // Implementation will query FeatureIndex
    throw new Error("Not implemented");
  }

  async getFeatureById(
    _nodeId: NodeId,
    _featureId: number,
  ): Promise<Feature | null> {
    // Implementation will retrieve from FeatureBuffer
    throw new Error("Not implemented");
  }

  async getFeaturesByBbox(
    _nodeId: NodeId,
    _bbox: BoundingBox,
    _options?: BboxQueryOptions,
  ): Promise<Feature[]> {
    // Implementation will use Morton code spatial index
    throw new Error("Not implemented");
  }

  // === Cache Management Methods ===

  async getCacheStatistics(_nodeId?: NodeId): Promise<CacheStatistics> {
    // Implementation will aggregate cache stats
    throw new Error("Not implemented");
  }

  async clearCache(_nodeId: NodeId, _cacheType?: CacheType): Promise<void> {
    // Implementation will clear specified caches
    throw new Error("Not implemented");
  }

  async optimizeStorage(_nodeId: NodeId): Promise<OptimizationResult> {
    // Implementation will run storage optimization
    throw new Error("Not implemented");
  }
}
