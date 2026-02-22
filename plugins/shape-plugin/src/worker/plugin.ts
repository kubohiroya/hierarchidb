/**
 * Shape Worker Plugin Definition
 * Worker environment plugin registration
 */

import { ShapeMetadata } from '~/common/types/metadata';
import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeEntity } from '~/common/types/index';
import { shapeBuildAPI } from './api.js';
import { ShapeEntityHandler } from './handlers/index.js';

/**
 * Worker Plugin definition for Shape plugin
 * Exports API implementation and entity handler for Worker environment
 */
const shapeEntityHandlerInstance = new ShapeEntityHandler();

export const ShapeWorkerPlugin = {
  metadata: ShapeMetadata,

  // Build API for runtime worker adapters.
  build: shapeBuildAPI,

  // Entity handler for database operations
  entityHandler: shapeEntityHandlerInstance,

  // Database schema definition
  database: {
    tableName: 'shapes',
    schema: '&id, nodeId, name, processingStatus, createdAt, updatedAt',
    version: 3,

    // Additional tables for shape-plugin data
    additionalTables: {
      shapeBatchSessions: '&nodeId',
      shapeBatchTasks: '&taskId, nodeId, stage, progress',
      shapeFeatures: '&featureId, nodeId, countryCode, adminLevel, geometry',
      shapeVectorTiles: '&tileId, nodeId, z, x, y, data, size',
      shapeCache: '&cacheKey, nodeId, cacheType, data, size, createdAt',
    },
  },

  // Worker-specific validation
  validation: {
    validateEntity: async (entity: Partial<ShapeEntity>) => {
      const errors: string[] = [];

      if (!entity.buildConfig?.dataSourceName) {
        errors.push('Data source is required');
      }

      if (!entity.buildConfig) {
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

    beforeDelete: async (nodeId: NodeId, _entity: ShapeEntity) => {
      // Cleanup processing data
      await shapeBuildAPI.cleanupProcessingData(nodeId);
    },

    afterUpdate: async (_nodeId: NodeId, _entity: ShapeEntity, _changes: Partial<ShapeEntity>) => {
      // Could trigger reprocessing if configuration changed
    },
  },
} as const;
