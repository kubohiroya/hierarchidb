/**
 * Shape Worker Plugin Definition
 * Worker environment plugin registration
 */

import { ShapeMetadata } from '../common/types/metadata.js';
import type { NodeId } from '@hierarchidb/common-types';
import type { ShapeEntity } from '../common/types/index.js';
import { shapePluginAPI } from './api.js';
import { ShapeEntityHandler } from './handlers/index.js';

/**
 * Worker Plugin definition for Shape plugin
 * Exports API implementation and entity handler for Worker environment
 */
const shapeEntityHandlerInstance = new ShapeEntityHandler();

export const ShapeWorkerPlugin = {
  metadata: ShapeMetadata,

  // Plugin API implementation for PluginRegistryImpl
  api: shapePluginAPI,

  // Entity handler for database operations
  entityHandler: shapeEntityHandlerInstance,

  // Database schema definition
  database: {
    tableName: 'shapes',
    schema: '&id, nodeId, name, dataSourceName, processingStatus, createdAt, updatedAt',
    version: 1,

    // Additional tables for shape-plugin data
    additionalTables: {
      shapeBatchSessions: '&sessionId, nodeId, status, startedAt, updatedAt',
      shapeBatchTasks: '&taskId, sessionId, taskType, stage, progress',
      shapeFeatures: '&featureId, nodeId, countryCode, adminLevel, geometry',
      shapeVectorTiles: '&tileId, nodeId, z, x, y, data, size',
      shapeCache: '&cacheKey, nodeId, cacheType, data, size, createdAt',
    },
  },

  // Worker-specific validation
  validation: {
    validateEntity: async (entity: Partial<ShapeEntity>) => {
      const errors: string[] = [];

      if (!entity.dataSourceName) {
        errors.push('Data source is required');
      }

      if (!entity.processingConfig) {
        errors.push('Processing configuration is required');
      }

      return {
        isValid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
      };
    },
  },

  // Worker-specific lifecycle hooks
  lifecycle: {
    afterCreate: async (_nodeId: NodeId, _entity: ShapeEntity) => {
      // Could initialize default resources, caches, etc.
    },

    beforeDelete: async (nodeId: NodeId, entity: ShapeEntity) => {
      // Cancel any active batch sessions
      if (entity.batchSessionId) {
        await shapePluginAPI.cancelBatchProcessing(nodeId);
      }
      // Cleanup processing data
      await shapePluginAPI.cleanupProcessingData(nodeId);
    },

    afterUpdate: async (_nodeId: NodeId, _entity: ShapeEntity, _changes: Partial<ShapeEntity>) => {
      // Could trigger reprocessing if configuration changed
    },
  },
} as const;
