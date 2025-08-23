/**
 * Import/Export Plugin Definition
 */

import type { PluginDefinition } from '@hierarchidb/00-core';
// ImportExportEntity is used in validation but TypeScript doesn't detect it

/**
 * Import/Export node type definition
 */
export const ImportExportDefinition: PluginDefinition = {
  // Basic information
  nodeType: 'import-export',
  name: 'ImportExport',
  displayName: 'Import/Export Operation',
  
  // Icon configuration
  icon: { 
    muiIconName: 'Sync',
    emoji: '🔄',
    color: '#2196F3',
    description: 'Import/Export data operations'
  },

  // Category configuration
  category: {
    treeId: '*',
    menuGroup: 'advanced',
    createOrder: 30,
  },

  // Database configuration
  database: {
    dbName: 'ImportExportDB',
    tableName: 'entities',
    schema: '&id, nodeId, name, operationType, status, createdAt, updatedAt, version',
    version: 1,
  },

  // Lifecycle hooks configuration (flags only for CoreNodeDefinition)
  lifecycle: {
    hasAfterCreate: true,
    hasBeforeDelete: true,
  },

  // Validation
  validation: {
    namePattern: /^[a-zA-Z0-9\s\-_]+$/,
    maxChildren: 0,
    customValidators: [
      {
        name: 'validateOperationName',
        validate: async (entity: any) => {
          if (!entity.name || entity.name.trim().length === 0) {
            return { valid: false, message: 'Operation name is required' };
          }
          if (entity.name.length > 255) {
            return { valid: false, message: 'Operation name must be less than 255 characters' };
          }
          return { valid: true };
        },
        getMessage: (entity: any) => 
          `Invalid operation name: "${entity.name}"`,
      },
    ],
  },
};;