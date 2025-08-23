/**
 * Shape Worker Plugin Definition
 * Worker environment plugin registration
 */

import { ShapeMetadata } from '../shared';
import { shapePluginAPI } from './api';
import { ShapeEntityHandler } from './handlers';

/**
 * Worker Plugin definition for Shape plugin
 * Exports API implementation and entity handler for Worker environment
 */
export const ShapeWorkerPlugin = {
  metadata: ShapeMetadata,
  
  // Plugin API implementation for PluginRegistry
  api: shapePluginAPI,
  
  // Entity handler for database operations
  entityHandler: new ShapeEntityHandler(),
  
  // Database schema definition
  database: {
    tableName: 'shapes',
    schema: '&id, nodeId, name, dataSourceName, processingStatus, createdAt, updatedAt',
    version: 1,
    
    // Additional tables for shape data
    additionalTables: {
      shapeBatchSessions: '&sessionId, nodeId, status, startedAt, updatedAt',
      shapeBatchTasks: '&taskId, sessionId, taskType, stage, progress',
      shapeFeatures: '&featureId, nodeId, countryCode, adminLevel, geometry',
      shapeVectorTiles: '&tileId, nodeId, z, x, y, data, size',
      shapeCache: '&cacheKey, nodeId, cacheType, data, size, createdAt'
    }
  },
  
  // Worker-specific validation
  validation: {
    validateEntity: async (entity: any) => {
      const errors: string[] = [];
      
      if (!entity.name?.trim()) {
        errors.push('Name is required');
      }
      
      if (!entity.dataSourceName) {
        errors.push('Data source is required');
      }
      
      if (!entity.processingConfig) {
        errors.push('Processing configuration is required');
      }
      
      return {
        isValid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
      };
    }
  },
  
  // Worker-specific lifecycle hooks
  lifecycle: {
    afterCreate: async (nodeId: any, entity: any) => {
      console.log(`Shape entity created: ${entity.id} for node: ${nodeId}`);
      // Could initialize default resources, caches, etc.
    },
    
    beforeDelete: async (nodeId: any, entity: any) => {
      console.log(`Cleaning up Shape entity: ${entity.id} for node: ${nodeId}`);
      // Cancel any active batch sessions
      if (entity.batchSessionId) {
        await shapePluginAPI.cancelBatchProcessing(entity.batchSessionId);
      }
      // Cleanup processing data
      await shapePluginAPI.cleanupProcessingData(nodeId);
    },
    
    afterUpdate: async (nodeId: any, entity: any, changes: any) => {
      console.log(`Shape entity updated: ${entity.id} for node: ${nodeId}`, changes);
      // Could trigger reprocessing if configuration changed
    }
  }
} as const;