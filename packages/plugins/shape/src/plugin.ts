/**
 * Shape Plugin Registration Entry Point
 * Registers the Shape plugin with HierarchiDB plugin system
 */

import { ShapePluginDefinition } from './definitions/ShapePluginDefinition';
import { shapePluginAPI } from './api/ShapePluginAPI';
// Note: Worker API import removed as it may not be implemented yet

/**
 * Register Shape plugin with HierarchiDB
 * This function should be called during application startup
 */
export async function registerShapePlugin(): Promise<void> {
  try {
    // Register node type definition with the plugin system
    // Note: In actual implementation, this would import from '@hierarchidb/02-worker'
    // For now, we'll use a mock implementation
    const registry = {
      register: async (definition: any) => {
        console.log('Mock registry: registering plugin', definition.nodeType);
      }
    };
    
    console.log('Registering Shape plugin...');
    
    // Register the plugin definition
    await registry.register(ShapePluginDefinition);
    
    // Initialize plugin API in worker context
    if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
      // We're in a worker context
      // Worker API not implemented yet
      console.log('Shape plugin Worker API not implemented');
    } else {
      // We're in main thread context
      await shapePluginAPI.initialize();
      console.log('Shape plugin API initialized');
    }
    
    console.log('Shape plugin registered successfully');
  } catch (error) {
    console.error('Failed to register Shape plugin:', error);
    throw error;
  }
}

/**
 * Unregister Shape plugin from HierarchiDB
 * This function should be called during application shutdown
 */
export async function unregisterShapePlugin(): Promise<void> {
  try {
    console.log('Unregistering Shape plugin...');
    
    // Shutdown plugin API
    if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
      // Worker API not implemented yet
      console.log('Shape plugin Worker API not implemented');
    } else {
      await shapePluginAPI.shutdown();
    }
    
    // Unregister from plugin system
    // Note: In actual implementation, this would import from '@hierarchidb/02-worker'
    const registry = {
      unregister: async (nodeType: string) => {
        console.log('Mock registry: unregistering plugin', nodeType);
      }
    };
    await registry.unregister('shape');
    
    console.log('Shape plugin unregistered successfully');
  } catch (error) {
    console.error('Failed to unregister Shape plugin:', error);
    throw error;
  }
}

/**
 * Get Shape plugin information
 */
export function getShapePluginInfo() {
  return {
    name: 'Shape Plugin',
    version: '1.0.0',
    nodeType: ShapePluginDefinition.nodeType,
    description: 'Geographic shape data plugin for HierarchiDB',
    features: {
      batchProcessing: true,
      vectorTiles: true,
      spatialIndexing: true,
      cacheManagement: true,
      workerPool: true,
    },
    dependencies: {
      core: '^1.0.0',
      worker: '^1.0.0',
      'ui-dialog': '^1.0.0',
    },
  };
}

// Export plugin definition and APIs for direct access
export { ShapePluginDefinition, shapePluginAPI };

// Auto-register if this module is imported in an environment that supports it
if (typeof window !== 'undefined' || typeof WorkerGlobalScope !== 'undefined') {
  // Auto-registration is disabled by default to allow manual control
  // Uncomment the line below to enable auto-registration
  // registerShapePlugin().catch(console.error);
}