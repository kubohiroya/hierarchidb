/**
 * Shape Worker Plugin Definition
 * Worker environment plugin registration
 */

import type { NodeId } from '@hierarchidb/core-types';
import type { ShapeEntity } from '~/common/types/ShapeEntity';
import { ShapeMetadata } from '~/common/types/ShapeMetadata';
import { shapeBuildAPI } from './api.js';
import { ShapeEntityService as ShapeEntityHandler } from './handlers/ShapeEntityService.js';

type ShapeWorkerPluginValidationResult = {
  isValid: boolean;
  errors?: string[];
};

type ShapeWorkerPluginType = {
  metadata: typeof ShapeMetadata;
  build: Record<string, unknown>;
  entityHandler: ShapeEntityHandler;
  database: {
    tableName: string;
    schema: string;
    version: number;
    additionalTables: Record<string, string>;
  };
  validation: {
    validateEntity: (
      entity: Partial<ShapeEntity>
    ) => Promise<ShapeWorkerPluginValidationResult> | ShapeWorkerPluginValidationResult;
  };
  lifecycle: {
    afterCreate: (_nodeId: NodeId, _entity: ShapeEntity) => Promise<void> | void;
    beforeDelete: (_nodeId: NodeId, _entity: ShapeEntity) => Promise<void> | void;
    afterUpdate: (
      _nodeId: NodeId,
      _entity: ShapeEntity,
      _changes: Partial<ShapeEntity>
    ) => Promise<void> | void;
  };
};

/**
 * Worker Plugin definition for Shape plugin
 * Exports API implementation and entity handler for Worker environment
 */
const shapeEntityHandlerInstance = new ShapeEntityHandler();

export const ShapeWorkerPlugin: ShapeWorkerPluginType = {
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
      shapeBuildSessions: '&nodeId',
      shapeBuildTasks: '&taskId, nodeId, stage, progress',
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
};
