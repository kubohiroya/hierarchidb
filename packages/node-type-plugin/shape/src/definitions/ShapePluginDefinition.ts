/**
 * Shape Plugin Definition for HierarchiDB
 * Integrates Shape plugin with the core plugin system
 */

import { ShapeEntityHandler } from '~/handlers/ShapeEntityHandler';

/**
 * Shape node type definition for HierarchiDB plugin system
 */
export const ShapePluginDefinition = {
  // Node type identifier
  nodeType: 'shape',
  
  // Entity handler for CRUD operations
  entityHandler: new ShapeEntityHandler(),

  // Simplified plugin metadata
  metadata: {
    version: '1.0.0',
    author: 'HierarchiDB Shape Plugin',
    description: 'Geographic shape data processing with vector tile generation',
    tags: ['geographic', 'vector', 'batch-processing', 'tiles'],
    features: {
      batchProcessing: true,
      vectorTiles: true,
      spatialIndexing: true,
      cacheManagement: true,
      workerPool: true,
    },
  },
};

export default ShapePluginDefinition;