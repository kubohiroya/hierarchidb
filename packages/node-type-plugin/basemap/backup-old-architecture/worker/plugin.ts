/**
 * BaseMap Worker Plugin definition
 * Integrates with the Worker plugin registry system
 */

// WorkerPlugin type not available, define inline for now
import { BaseMapMetadata } from '../shared';
import { BaseMapEntityHandler } from './handlers';
import { basemapPluginAPI } from './api';

/**
 * BaseMap Worker Plugin configuration
 */
export const BaseMapWorkerPlugin = {
  // Plugin metadata (shared with UI)
  metadata: BaseMapMetadata,
  
  // Plugin API implementation (exposed via Comlink)
  api: basemapPluginAPI,
  
  // Entity handler for database operations
  entityHandler: new BaseMapEntityHandler(),
  
  // Database configuration
  database: {
    tableName: 'basemaps',
    schema: '&id, nodeId, name, mapStyle, [mapStyle+name], [nodeId+updatedAt], createdAt, updatedAt, version',
    version: 1,
    indices: [
      'nodeId',
      '[mapStyle+name]', // Compound index for filtering by style and name
      'createdAt',
      'updatedAt'
    ]
  },
  
  // Worker-side validation
  validation: {
    async validateEntity(entity: BaseMapEntity): Promise<ValidationResult> {
      const { validateUpdateBaseMapData } = await import('../shared');
      
      return validateUpdateBaseMapData({
        name: entity.name,
        mapStyle: entity.mapStyle,
        center: entity.center,
        zoom: entity.zoom,
        bearing: entity.bearing,
        pitch: entity.pitch,
        bounds: entity.bounds
      });
    }
  },
  
  // Worker-side lifecycle hooks
  lifecycle: {
    async beforeCreate(nodeId: NodeId, _data: unknown): Promise<void> {
      // Pre-creation validation and setup
      console.log(`Creating BaseMap for node ${nodeId}`);
    },
    
    async afterCreate(_nodeId: NodeId, entity: BaseMapEntity): Promise<void> {
      // Post-creation setup (e.g., initialize cache, validate style)
      console.log(`BaseMap created: ${entity.name} (${entity.id})`);
      
      // Initialize tile cache if needed
      console.log(`Initializing tile cache for ${entity.name}`);
    },
    
    async beforeUpdate(nodeId: NodeId, _updates: unknown): Promise<void> {
      // Pre-update validation
      console.log(`Updating BaseMap for node ${nodeId}`);
    },
    
    async afterUpdate(_nodeId: NodeId, entity: BaseMapEntity): Promise<void> {
      // Post-update processing
      console.log(`BaseMap updated: ${entity.name} (${entity.id})`);
      
      // Clear thumbnail cache if style changed  
      console.log(`Clearing thumbnail cache for ${entity.name}`);
    },
    
    async beforeDelete(nodeId: NodeId): Promise<void> {
      // Pre-deletion cleanup
      console.log(`Cleaning up resources for BaseMap node ${nodeId}`);
    },
    
    async afterDelete(nodeId: NodeId): Promise<void> {
      // Post-deletion cleanup
      console.log(`BaseMap deleted for node ${nodeId}`);
    }
  },

  // Additional worker-specific methods
  async initializeTileCache(entity: BaseMapEntity): Promise<void> {
    // Initialize tile caching for the basemap
    // This would set up IndexedDB cache tables, cache policies, etc.
    console.log(`Initializing tile cache for ${entity.name}`);
  },

  async clearThumbnailCache(entity: BaseMapEntity): Promise<void> {
    // Clear cached thumbnails when map style changes
    console.log(`Clearing thumbnail cache for ${entity.name}`);
    
    // Update entity to remove thumbnail URL
    await this.entityHandler.updateEntity(entity.nodeId, { 
      thumbnailUrl: undefined 
    });
  },

  async cleanupResources(entity: BaseMapEntity): Promise<void> {
    // Clean up resources before deletion
    console.log(`Cleaning up resources for ${entity.name}`);
    
    // Clear tile cache
    await this.clearTileCache(entity);
    
    // Remove thumbnail files
    await this.clearThumbnailCache(entity);
    
    // Clear any other cached data
  },

  async clearTileCache(entity: BaseMapEntity): Promise<void> {
    // Clear all cached tiles for this basemap
    console.log(`Clearing tile cache for ${entity.name}`);
  }
};

// Type imports (needed for TypeScript)
import type { BaseMapEntity } from '../shared';
import type { NodeId } from '@hierarchidb/common-core';
import type { ValidationResult } from '../shared';