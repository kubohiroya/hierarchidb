/**
 * Worker API integration for Shape plugin
 * Connects with HierarchiDB Worker layer via Comlink
 */

import * as Comlink from 'comlink';
import { NodeId } from '@hierarchidb/00-core';
import { ShapePluginAPI, shapePluginAPI } from './ShapePluginAPI';

/**
 * Worker-exposed API for Shape plugin
 * This class is exposed to the main thread via Comlink
 */
export class ShapeWorkerAPI {
  private pluginAPI: ShapePluginAPI;
  private isInitialized = false;

  constructor() {
    this.pluginAPI = shapePluginAPI;
  }

  /**
   * Initialize the Shape plugin in Worker context
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.pluginAPI.initialize();
      this.isInitialized = true;
      console.log('ShapeWorkerAPI initialized in Worker context');
    } catch (error) {
      console.error('Failed to initialize ShapeWorkerAPI:', error);
      throw error;
    }
  }

  /**
   * Shutdown the Shape plugin
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      await this.pluginAPI.shutdown();
      this.isInitialized = false;
      console.log('ShapeWorkerAPI shutdown complete');
    } catch (error) {
      console.error('Error during ShapeWorkerAPI shutdown:', error);
      throw error;
    }
  }

  // === Batch Processing API ===

  async startBatchProcess(nodeId: NodeId, config: any): Promise<any> {
    this.ensureInitialized();
    return this.pluginAPI.startBatchProcess(nodeId, config);
  }

  async pauseBatchProcess(sessionId: string): Promise<void> {
    this.ensureInitialized();
    return this.pluginAPI.pauseBatchProcess(sessionId);
  }

  async resumeBatchProcess(sessionId: string): Promise<void> {
    this.ensureInitialized();
    return this.pluginAPI.resumeBatchProcess(sessionId);
  }

  async cancelBatchProcess(sessionId: string): Promise<void> {
    this.ensureInitialized();
    return this.pluginAPI.cancelBatchProcess(sessionId);
  }

  async getBatchStatus(sessionId: string): Promise<any> {
    this.ensureInitialized();
    return this.pluginAPI.getBatchStatus(sessionId);
  }

  // === Data Source API ===

  async getAvailableDataSources(): Promise<any[]> {
    this.ensureInitialized();
    return this.pluginAPI.getAvailableDataSources();
  }

  async getCountryMetadata(dataSource: string, countryCode?: string): Promise<any[]> {
    this.ensureInitialized();
    return this.pluginAPI.getCountryMetadata(dataSource, countryCode);
  }

  async validateDataSource(dataSource: string, config: any): Promise<any> {
    this.ensureInitialized();
    return this.pluginAPI.validateDataSource(dataSource, config);
  }

  // === Vector Tile API ===

  async getTile(nodeId: NodeId, z: number, x: number, y: number): Promise<Uint8Array> {
    this.ensureInitialized();
    return this.pluginAPI.getTile(nodeId, z, x, y);
  }

  async getTileMetadata(nodeId: NodeId, z: number, x: number, y: number): Promise<any> {
    this.ensureInitialized();
    return this.pluginAPI.getTileMetadata(nodeId, z, x, y);
  }

  async clearTileCache(nodeId: NodeId): Promise<void> {
    this.ensureInitialized();
    return this.pluginAPI.clearTileCache(nodeId);
  }

  // === Feature Query API ===

  async searchFeatures(nodeId: NodeId, query: string, options?: any): Promise<any[]> {
    this.ensureInitialized();
    return this.pluginAPI.searchFeatures(nodeId, query, options);
  }

  async getFeatureById(nodeId: NodeId, featureId: number): Promise<any | null> {
    this.ensureInitialized();
    return this.pluginAPI.getFeatureById(nodeId, featureId);
  }

  async getFeaturesByBbox(nodeId: NodeId, bbox: [number, number, number, number], options?: any): Promise<any[]> {
    this.ensureInitialized();
    return this.pluginAPI.getFeaturesByBbox(nodeId, bbox, options);
  }

  // === Cache Management API ===

  async getCacheStatistics(nodeId?: NodeId): Promise<any> {
    this.ensureInitialized();
    return this.pluginAPI.getCacheStatistics(nodeId);
  }

  async clearCache(nodeId: NodeId, cacheType?: string): Promise<void> {
    this.ensureInitialized();
    return this.pluginAPI.clearCache(nodeId, cacheType as any);
  }

  async optimizeStorage(nodeId: NodeId): Promise<any> {
    this.ensureInitialized();
    return this.pluginAPI.optimizeStorage(nodeId);
  }

  // === Monitoring API ===

  async getWorkerPoolStatistics(): Promise<any> {
    this.ensureInitialized();
    return this.pluginAPI.getWorkerPoolStatistics();
  }

  async getActiveBatchSessions(): Promise<any[]> {
    this.ensureInitialized();
    return this.pluginAPI.getActiveBatchSessions();
  }

  async getHealthStatus(): Promise<any> {
    this.ensureInitialized();
    return this.pluginAPI.getHealthStatus();
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('ShapeWorkerAPI not initialized. Call initialize() first.');
    }
  }
}

// Create and expose the worker API instance
const shapeWorkerAPI = new ShapeWorkerAPI();

// Expose the API to the main thread via Comlink
Comlink.expose(shapeWorkerAPI);

// Export for local use
export { shapeWorkerAPI };