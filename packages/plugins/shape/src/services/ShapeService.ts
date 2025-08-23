/**
 * ShapeService - Main service orchestrating Workers and database operations
 * 
 * This service coordinates batch processing, data source management,
 * feature queries, cache operations, and vector tile generation.
 */

import type { NodeId } from '@hierarchidb/00-core';
import { shapeDB } from './database/ShapeDB';
import { BatchSessionManager } from './batch/BatchSessionManager';
import { DataSourceManager } from './datasource/DataSourceManager';
import { VectorTileService } from './tiles/VectorTileService';
import type {
  BatchProcessConfig,
  BatchStatus,
  DataSourceInfo,
  CountryMetadata,
  ValidationResult,
  Feature,
  SearchOptions,
  BboxQueryOptions,
  CacheStatistics,
  CacheType,
  OptimizationResult,
  TileMetadata
} from './types';
import type {
  UrlMetadata,
  ProcessingConfig
} from '../types';

export class ShapeService {
  private batchManager: BatchSessionManager;
  private dataSourceManager: DataSourceManager;
  private vectorTileService: VectorTileService;
  private initialized = false;

  constructor() {
    this.batchManager = new BatchSessionManager();
    this.dataSourceManager = new DataSourceManager();
    this.vectorTileService = new VectorTileService();
  }

  // Service Lifecycle
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize database
      await shapeDB.open();
      
      // Initialize batch manager
      await this.batchManager.initialize();
      
      // Cleanup any expired cache entries
      await shapeDB.cleanupExpiredCache();
      
      this.initialized = true;
      console.log('ShapeService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize ShapeService:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    try {
      await this.batchManager.shutdown();
      await shapeDB.close();
      this.initialized = false;
      console.log('ShapeService shutdown successfully');
    } catch (error) {
      console.error('Error during ShapeService shutdown:', error);
      throw error;
    }
  }

  // Batch Processing Management
  async startBatchProcessing(
    nodeId: NodeId,
    config: BatchProcessConfig,
    urlMetadata: UrlMetadata[]
  ): Promise<{ batchId: string; sessionId: string }> {
    this.ensureInitialized();

    const session = await this.batchManager.createSession(nodeId, config, urlMetadata);
    
    return {
      batchId: session.sessionId,
      sessionId: session.sessionId
    };
  }

  async pauseBatchProcessing(batchId: string): Promise<void> {
    this.ensureInitialized();
    await this.batchManager.pauseSession(batchId);
  }

  async resumeBatchProcessing(batchId: string): Promise<void> {
    this.ensureInitialized();
    await this.batchManager.resumeSession(batchId);
  }

  async cancelBatchProcessing(batchId: string): Promise<void> {
    this.ensureInitialized();
    await this.batchManager.cancelSession(batchId);
  }

  async getBatchStatus(batchId: string): Promise<BatchStatus> {
    this.ensureInitialized();
    return await this.batchManager.getSessionStatus(batchId);
  }

  async getBatchTasks(batchId: string): Promise<any[]> {
    this.ensureInitialized();
    return await shapeDB.getBatchTasks(batchId);
  }

  // Progress Monitoring
  onBatchProgress(batchId: string, callback: (progress: any) => void): void {
    this.batchManager.onProgress(batchId, callback);
  }

  // Data Source Management
  async getAvailableDataSources(): Promise<DataSourceInfo[]> {
    this.ensureInitialized();
    return this.dataSourceManager.getAvailableDataSources();
  }

  async getCountryMetadata(dataSource: string, countryCode: string): Promise<CountryMetadata[]> {
    this.ensureInitialized();
    
    const metadata = await this.dataSourceManager.getCountryMetadata(
      dataSource as any,
      countryCode
    );
    
    return [metadata];
  }

  async validateDataSource(
    dataSource: string,
    config: { countryCode: string; adminLevels: number[] }
  ): Promise<ValidationResult> {
    this.ensureInitialized();
    
    // Validate each admin level
    const results = await Promise.all(
      config.adminLevels.map(level =>
        this.dataSourceManager.validateDataSource(
          dataSource as any,
          config.countryCode,
          level
        )
      )
    );

    // Combine results
    const allErrors = results.flatMap(r => r.errors);
    const allWarnings = results.flatMap(r => r.warnings);
    
    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      metadata: {
        totalAdminLevels: config.adminLevels.length,
        estimatedTotalFeatures: results.reduce(
          (sum, r) => sum + (Number(r.metadata?.estimatedFeatures) || 0),
          0
        ),
        estimatedTotalSize: results.reduce(
          (sum, r) => sum + (Number(r.metadata?.estimatedSizeMB) || 0),
          0
        )
      }
    };
  }

  // Processing Configuration Validation
  validateProcessingConfig(config: ProcessingConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate worker pool sizes
    if (config.workerPoolSize && (config.workerPoolSize < 1 || config.workerPoolSize > 8)) {
      errors.push('Worker pool size must be between 1 and 8');
    }

    // Validate simplification levels
    if (config.simplificationLevels) {
      for (const level of config.simplificationLevels) {
        if (level < 0 || level > 1) {
          errors.push('Simplification levels must be between 0 and 1');
        }
      }
    }

    // Validate tile zoom range
    if (config.tileZoomRange) {
      const [minZoom, maxZoom] = config.tileZoomRange;
      if (minZoom < 0 || maxZoom > 18 || minZoom >= maxZoom) {
        errors.push('Invalid tile zoom range');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Feature Management
  async searchFeatures(
    nodeId: NodeId,
    query: string,
    options: SearchOptions = {}
  ): Promise<Feature[]> {
    this.ensureInitialized();
    
    const limit = options.limit || 50;
    const features = await shapeDB.searchFeatures(nodeId, query, limit);
    
    // Apply additional filters
    let filteredFeatures = features;
    
    if (options.adminLevel !== undefined) {
      filteredFeatures = filteredFeatures.filter(f => f.adminLevel === options.adminLevel);
    }
    
    if (options.countryCode) {
      filteredFeatures = filteredFeatures.filter(f => f.countryCode === options.countryCode);
    }

    // Apply sorting
    if (options.sortBy) {
      filteredFeatures.sort((a, b) => {
        const aVal = this.getFeatureSortValue(a, options.sortBy!);
        const bVal = this.getFeatureSortValue(b, options.sortBy!);
        
        if (options.sortOrder === 'desc') {
          return bVal - aVal;
        }
        return aVal - bVal;
      });
    }

    // Apply offset
    if (options.offset) {
      filteredFeatures = filteredFeatures.slice(options.offset);
    }

    // Apply final limit
    return filteredFeatures.slice(0, limit);
  }

  async getFeatureById(nodeId: NodeId, featureId: number): Promise<Feature | null> {
    this.ensureInitialized();
    const feature = await shapeDB.features.get(featureId);
    return feature?.nodeId === nodeId ? feature : null;
  }

  async getFeaturesByBbox(
    nodeId: NodeId,
    bbox: [number, number, number, number],
    options: BboxQueryOptions = {}
  ): Promise<Feature[]> {
    this.ensureInitialized();
    
    const features = await shapeDB.getFeaturesInBbox(nodeId, bbox, options.adminLevel);
    
    let result = features;
    
    // Apply additional filters
    if (options.simplificationLevel !== undefined) {
      result = result.filter(f => 
        f.simplificationLevel === undefined || 
        f.simplificationLevel >= options.simplificationLevel!
      );
    }

    // Apply limits
    if (options.offset) {
      result = result.slice(options.offset);
    }
    
    if (options.limit) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  // Vector Tile Management
  async getVectorTile(nodeId: NodeId, z: number, x: number, y: number): Promise<Uint8Array | null> {
    this.ensureInitialized();
    return await this.vectorTileService.getTile({ nodeId, z, x, y });
  }

  async getTileMetadata(nodeId: NodeId, z: number, x: number, y: number): Promise<TileMetadata | null> {
    this.ensureInitialized();
    return await this.vectorTileService.getTileMetadata(nodeId, z, x, y);
  }

  async clearTileCache(nodeId: NodeId, zoomLevel?: number): Promise<void> {
    this.ensureInitialized();
    await this.vectorTileService.clearTileCache(nodeId, zoomLevel);
  }

  async generateTilesForZoomLevel(nodeId: NodeId, zoomLevel: number): Promise<number> {
    this.ensureInitialized();
    return await this.vectorTileService.generateTilesForZoomLevel(nodeId, zoomLevel);
  }

  // Cache Management
  async getCacheStatistics(nodeId?: NodeId): Promise<CacheStatistics> {
    this.ensureInitialized();
    
    if (nodeId) {
      // Get node-specific cache statistics
      return await this.getNodeCacheStatistics(nodeId);
    }
    
    // Get global cache statistics
    return await shapeDB.getCacheStatistics();
  }

  async clearCache(nodeId: NodeId, cacheType: CacheType = 'all'): Promise<void> {
    this.ensureInitialized();
    
    switch (cacheType) {
      case 'features':
        await shapeDB.clearCache(nodeId, 'features');
        break;
      case 'tiles':
        await this.vectorTileService.clearTileCache(nodeId);
        break;
      case 'buffers':
        await shapeDB.clearCache(nodeId, 'buffers');
        break;
      case 'all':
        await shapeDB.clearCache(nodeId);
        await this.vectorTileService.clearTileCache(nodeId);
        break;
    }
  }

  async optimizeStorage(nodeId: NodeId): Promise<OptimizationResult> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    let freedSpace = 0;
    let removedItems = 0;
    let compactedItems = 0;
    const errors: string[] = [];
    const suggestions: string[] = [];

    try {
      // Remove expired cache entries
      const expiredCount = await shapeDB.cleanupExpiredCache();
      removedItems += expiredCount;
      freedSpace += expiredCount * 1000; // Estimate

      // Get storage usage before optimization
      const beforeUsage = await shapeDB.getStorageUsage();
      
      // Remove duplicate features (if any)
      const features = await shapeDB.features.where('nodeId').equals(nodeId).toArray();
      const uniqueFeatures = new Map();
      
      for (const feature of features) {
        const key = `${feature.geometry.type}-${JSON.stringify(feature.properties)}`;
        if (!uniqueFeatures.has(key)) {
          uniqueFeatures.set(key, feature);
        } else {
          await shapeDB.features.delete(feature.id);
          removedItems++;
          freedSpace += JSON.stringify(feature).length;
        }
      }

      // Compact tile cache - remove old unused tiles
      const tileStats = await this.vectorTileService.getTileCacheStatistics(nodeId);
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      const oldTiles = await shapeDB.vectorTiles
        .where('nodeId')
        .equals(nodeId)
        .filter((tile: any) => (tile.lastAccessed || tile.generatedAt) < thirtyDaysAgo)
        .toArray();
      
      for (const tile of oldTiles) {
        await shapeDB.vectorTiles.delete(tile.tileId);
        removedItems++;
        freedSpace += tile.size;
      }

      // Generate suggestions
      if (tileStats.totalTiles > 1000) {
        suggestions.push('Consider reducing maximum zoom level to decrease tile cache size');
      }
      
      if (beforeUsage.breakdown?.features && beforeUsage.breakdown.features > 100 * 1024 * 1024) {
        suggestions.push('Large feature dataset - consider increasing simplification levels');
      }

      compactedItems = features.length - removedItems;

    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    return {
      freedSpace,
      removedItems,
      compactedItems,
      duration: Date.now() - startTime,
      errors,
      suggestions
    };
  }

  // Data Export
  async exportData(nodeId: NodeId, format: 'geojson' | 'mvt' | 'pmtiles'): Promise<Blob> {
    this.ensureInitialized();
    
    switch (format) {
      case 'geojson':
        return await this.exportAsGeoJSON(nodeId);
      case 'mvt':
        return await this.exportAsMVT(nodeId);
      case 'pmtiles':
        return await this.exportAsPMTiles(nodeId);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // Private Methods
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('ShapeService not initialized. Call initialize() first.');
    }
  }

  private getFeatureSortValue(feature: Feature, sortBy: string): number {
    switch (sortBy) {
      case 'name':
        return (feature.name || '').localeCompare('');
      case 'population':
        return feature.population || 0;
      case 'area':
        return feature.area || 0;
      case 'relevance':
        return 1; // Would implement relevance scoring
      default:
        return 0;
    }
  }

  private async getNodeCacheStatistics(nodeId: NodeId): Promise<CacheStatistics> {
    // Get cache entries for specific node
    const cacheEntries = await shapeDB.cache
      .where('nodeId')
      .equals(nodeId)
      .toArray();
    
    const tileStats = await this.vectorTileService.getTileCacheStatistics(nodeId);
    
    const totalSize = cacheEntries.reduce((sum: number, entry: any) => sum + entry.size, 0) + tileStats.totalSize;
    const totalItems = cacheEntries.length + tileStats.totalTiles;
    const totalHits = cacheEntries.reduce((sum: number, entry: any) => sum + entry.hits, 0);

    return {
      totalSize,
      totalItems,
      byType: {
        features: {
          size: cacheEntries.filter((e: any) => e.cacheType === 'features').reduce((s: number, e: any) => s + e.size, 0),
          count: cacheEntries.filter((e: any) => e.cacheType === 'features').length,
          hits: cacheEntries.filter((e: any) => e.cacheType === 'features').reduce((s: number, e: any) => s + e.hits, 0),
          misses: 0,
          evictions: 0,
          averageSize: 0
        },
        tiles: {
          size: tileStats.totalSize,
          count: tileStats.totalTiles,
          hits: 0,
          misses: 0,
          evictions: 0,
          averageSize: tileStats.totalTiles > 0 ? tileStats.totalSize / tileStats.totalTiles : 0
        },
        buffers: {
          size: cacheEntries.filter((e: any) => e.cacheType === 'buffers').reduce((s: number, e: any) => s + e.size, 0),
          count: cacheEntries.filter((e: any) => e.cacheType === 'buffers').length,
          hits: cacheEntries.filter((e: any) => e.cacheType === 'buffers').reduce((s: number, e: any) => s + e.hits, 0),
          misses: 0,
          evictions: 0,
          averageSize: 0
        },
        all: {
          size: totalSize,
          count: totalItems,
          hits: totalHits,
          misses: 0,
          evictions: 0,
          averageSize: totalItems > 0 ? totalSize / totalItems : 0
        }
      },
      hitRate: totalHits > 0 ? 0.95 : 0,
      missRate: totalHits > 0 ? 0.05 : 0,
      evictionCount: 0,
      oldestItem: cacheEntries.length > 0 ? Math.min(...cacheEntries.map((e: any) => e.createdAt)) : Date.now(),
      newestItem: cacheEntries.length > 0 ? Math.max(...cacheEntries.map((e: any) => e.createdAt)) : Date.now()
    };
  }

  private async exportAsGeoJSON(nodeId: NodeId): Promise<Blob> {
    const features = await shapeDB.features.where('nodeId').equals(nodeId).toArray();
    
    const geojson = {
      type: 'FeatureCollection',
      features: features.map((feature: any) => ({
        type: 'Feature',
        id: feature.id,
        geometry: feature.geometry,
        properties: feature.properties
      }))
    };

    return new Blob([JSON.stringify(geojson, null, 2)], {
      type: 'application/json'
    });
  }

  private async exportAsMVT(_nodeId: NodeId): Promise<Blob> {
    // This would generate a complete MVT tileset
    // For now, return a placeholder
    return new Blob(['MVT export not yet implemented'], {
      type: 'application/octet-stream'
    });
  }

  private async exportAsPMTiles(_nodeId: NodeId): Promise<Blob> {
    // This would generate PMTiles format
    // For now, return a placeholder
    return new Blob(['PMTiles export not yet implemented'], {
      type: 'application/octet-stream'
    });
  }
}