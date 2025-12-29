/**
 * Shape Worker Plugin Definition
 * Worker environment plugin registration
 */

import { ShapeMetadata } from '../common/types/metadata.js';
import type { NodeId } from '@hierarchidb/common-types';
import type { ShapeEntity } from '../common/types/index.js';
import { shapeBatchAPI } from './api.js';
import { ShapeEntityHandler } from './handlers/index.js';

/**
 * Worker Plugin definition for Shape plugin
 * Exports API implementation and entity handler for Worker environment
 */
const shapeEntityHandlerInstance = new ShapeEntityHandler();

export const ShapeWorkerPlugin = {
  metadata: ShapeMetadata,

  // Batch API for runtime worker adapters (non-public)
  batch: shapeBatchAPI,

  // Entity handler for database operations
  entityHandler: shapeEntityHandlerInstance,

  // Database schema definition
  database: {
    tableName: 'shapes',
    schema: '&id, nodeId, name, dataSourceName, processingStatus, createdAt, updatedAt',
    version: 1,

    // Additional tables for shape-plugin data
    additionalTables: {
      shapeBatchSessions: '&nodeId, status, startedAt, updatedAt',
      shapeBatchTasks: '&taskId, nodeId, taskType, stage, progress',
      shapeFeatures: '&featureId, nodeId, countryCode, adminLevel, geometry',
      shapeVectorTiles: '&tileId, nodeId, z, x, y, data, size',
      shapeCache: '&cacheKey, nodeId, cacheType, data, size, createdAt',
    },
  },

  // Worker-specific validation
  validation: {
    validateEntity: async (entity: Partial<ShapeEntity>) => {
      const errors: string[] = [];

      if (!entity.batchConfig?.dataSource) {
        errors.push('Data source is required');
      }

      if (!entity.batchConfig) {
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
      // Pause any active batch sessions before cleanup (nodeId is the only identifier).
      try {
        await shapeBatchAPI.pauseBatchProcessing(nodeId);
      } catch (error) {
        console.warn('[shape-plugin] failed to pause batch processing before delete', error);
      }
      // Cleanup processing data
      await shapeBatchAPI.cleanupProcessingData(nodeId);
    },

    afterUpdate: async (_nodeId: NodeId, _entity: ShapeEntity, _changes: Partial<ShapeEntity>) => {
      // Could trigger reprocessing if configuration changed
    },
  },
} as const;
